//! Sender Keys — group message encryption (Signal "Sender Keys" scheme).
//!
//! Each member, per group, holds a *sender key*: a symmetric chain key (ratcheted
//! with the same HMAC construction as the 1:1 Double Ratchet, see [`ChainKey`]) plus
//! an Ed25519 signing key. To send a group message the member ratchets their chain
//! key forward, derives a per-message AES-256-GCM key, encrypts, and signs the
//! payload. Members distribute their sender key to each other *once* over the existing
//! pairwise 1:1 channel (a [`SenderKeyDistributionMessage`]); thereafter group sends
//! are a single symmetric encryption regardless of group size, and the server only
//! ever relays opaque ciphertext.
//!
//! This module is transport-agnostic: it has no knowledge of the wire protocol or the
//! server. Distribution messages are encrypted to each peer by the caller using the
//! pairwise [`crate::session::SessionManager`].

use crate::cipher;
use crate::ratchet::ChainKey;
use crate::{CryptoError, Result};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Maximum number of skipped messages whose keys we retain, bounding memory against
/// a peer that claims a huge iteration. Mirrors the Double Ratchet's `MAX_SKIP`.
const MAX_SKIP: u32 = 2000;

/// Associated data signed/authenticated for each message: `key_id || iteration`.
fn message_ad(key_id: u32, iteration: u32) -> [u8; 8] {
    let mut ad = [0u8; 8];
    ad[0..4].copy_from_slice(&key_id.to_le_bytes());
    ad[4..8].copy_from_slice(&iteration.to_le_bytes());
    ad
}

/// The bytes an Ed25519 signature is computed over: associated data || ciphertext.
fn signing_input(key_id: u32, iteration: u32, ciphertext: &[u8]) -> Vec<u8> {
    let mut input = Vec::with_capacity(8 + ciphertext.len());
    input.extend_from_slice(&message_ad(key_id, iteration));
    input.extend_from_slice(ciphertext);
    input
}

/// A member's *own* sender key for one group, used to encrypt outgoing messages.
///
/// Not `Serialize`/`Deserialize` directly (it holds a private signing key); use
/// [`SenderKey::to_bytes`] / [`SenderKey::from_bytes`] for persistence.
pub struct SenderKey {
    key_id: u32,
    chain_key: ChainKey,
    iteration: u32,
    signing_key: SigningKey,
}

impl SenderKey {
    /// Generate a fresh sender key (random chain key + Ed25519 signing key).
    pub fn generate(key_id: u32) -> Self {
        let mut chain = [0u8; 32];
        OsRng.fill_bytes(&mut chain);
        let signing_key = SigningKey::generate(&mut OsRng);
        Self {
            key_id,
            chain_key: ChainKey::from_bytes(chain),
            iteration: 0,
            signing_key,
        }
    }

    pub fn key_id(&self) -> u32 {
        self.key_id
    }

    /// The distribution message to hand to a group member so they can decrypt this
    /// member's messages. Carries the *current* chain key, so a new member only
    /// decrypts messages from this iteration onward (forward secrecy for the past).
    pub fn distribution_message(&self) -> SenderKeyDistributionMessage {
        SenderKeyDistributionMessage {
            key_id: self.key_id,
            iteration: self.iteration,
            chain_key: self.chain_key.to_bytes(),
            signing_public: self.signing_key.verifying_key().to_bytes(),
        }
    }

    /// Encrypt and sign a group message, advancing the chain key by one.
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<SenderKeyMessage> {
        let (next, message_key) = self.chain_key.advance();
        let iteration = self.iteration;
        let ad = message_ad(self.key_id, iteration);
        let ciphertext = cipher::encrypt_with_ad(message_key.as_bytes(), plaintext, &ad)?;
        let signature = self
            .signing_key
            .sign(&signing_input(self.key_id, iteration, &ciphertext))
            .to_bytes()
            .to_vec();

        self.chain_key = next;
        self.iteration = self
            .iteration
            .checked_add(1)
            .ok_or(CryptoError::CounterOverflow)?;

        Ok(SenderKeyMessage {
            key_id: self.key_id,
            iteration,
            ciphertext,
            signature,
        })
    }

    /// Serialize for persistence: `key_id(4) || iteration(4) || chain(32) || seed(32)`.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(72);
        out.extend_from_slice(&self.key_id.to_le_bytes());
        out.extend_from_slice(&self.iteration.to_le_bytes());
        out.extend_from_slice(&self.chain_key.to_bytes());
        out.extend_from_slice(&self.signing_key.to_bytes());
        out
    }

    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        if data.len() != 72 {
            return Err(CryptoError::InvalidKeyLength {
                expected: 72,
                actual: data.len(),
            });
        }
        let key_id = u32::from_le_bytes(data[0..4].try_into().unwrap());
        let iteration = u32::from_le_bytes(data[4..8].try_into().unwrap());
        let mut chain = [0u8; 32];
        chain.copy_from_slice(&data[8..40]);
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&data[40..72]);
        Ok(Self {
            key_id,
            chain_key: ChainKey::from_bytes(chain),
            iteration,
            signing_key: SigningKey::from_bytes(&seed),
        })
    }
}

/// A sender key received from a group member, used to decrypt their messages.
pub struct SenderKeyRecord {
    key_id: u32,
    chain_key: ChainKey,
    iteration: u32,
    signing_public: VerifyingKey,
    /// Message keys for iterations we skipped (out-of-order / dropped messages).
    skipped: HashMap<u32, [u8; 32]>,
}

impl SenderKeyRecord {
    /// Build a record from a peer's distribution message.
    pub fn from_distribution(msg: &SenderKeyDistributionMessage) -> Result<Self> {
        let signing_public = VerifyingKey::from_bytes(&msg.signing_public)
            .map_err(|_| CryptoError::InvalidSignature)?;
        Ok(Self {
            key_id: msg.key_id,
            chain_key: ChainKey::from_bytes(msg.chain_key),
            iteration: msg.iteration,
            signing_public,
            skipped: HashMap::new(),
        })
    }

    pub fn key_id(&self) -> u32 {
        self.key_id
    }

    /// Verify and decrypt a group message from this sender, ratcheting (and caching
    /// skipped keys) as needed to reach the message's iteration.
    pub fn decrypt(&mut self, msg: &SenderKeyMessage) -> Result<Vec<u8>> {
        if msg.key_id != self.key_id {
            // A different sender-key generation (e.g. after rotation on membership
            // change). The caller must install the matching record first.
            return Err(CryptoError::SessionNotFound(format!(
                "sender key id {} does not match record {}",
                msg.key_id, self.key_id
            )));
        }

        // Authenticate before doing any key derivation.
        let signature =
            Signature::from_slice(&msg.signature).map_err(|_| CryptoError::InvalidSignature)?;
        self.signing_public
            .verify(
                &signing_input(msg.key_id, msg.iteration, &msg.ciphertext),
                &signature,
            )
            .map_err(|_| CryptoError::InvalidSignature)?;

        let ad = message_ad(msg.key_id, msg.iteration);

        // Past message: use a cached skipped key (and consume it), else it's a replay
        // or a key we already discarded.
        if msg.iteration < self.iteration {
            let key = self
                .skipped
                .remove(&msg.iteration)
                .ok_or(CryptoError::DuplicateMessage)?;
            return cipher::decrypt_with_ad(&key, &msg.ciphertext, &ad);
        }

        // Guard against an absurd forward jump before ratcheting.
        if msg.iteration - self.iteration > MAX_SKIP {
            return Err(CryptoError::MessageTooOld);
        }

        // Ratchet forward to the target iteration, caching skipped message keys.
        while self.iteration < msg.iteration {
            let (next, mk) = self.chain_key.advance();
            self.skipped.insert(self.iteration, *mk.as_bytes());
            self.chain_key = next;
            self.iteration += 1;
        }

        // Derive the key for this iteration and advance past it.
        let (next, message_key) = self.chain_key.advance();
        self.chain_key = next;
        self.iteration += 1;
        cipher::decrypt_with_ad(message_key.as_bytes(), &msg.ciphertext, &ad)
    }
}

/// Distributed to group members over the pairwise channel so they can decrypt a
/// member's group messages.
#[derive(Clone, Serialize, Deserialize)]
pub struct SenderKeyDistributionMessage {
    pub key_id: u32,
    pub iteration: u32,
    pub chain_key: [u8; 32],
    pub signing_public: [u8; 32],
}

impl SenderKeyDistributionMessage {
    pub fn to_bytes(&self) -> Result<Vec<u8>> {
        bincode::serialize(self).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }
    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        bincode::deserialize(data).map_err(|e| CryptoError::DeserializationError(e.to_string()))
    }
}

/// An encrypted group message. This is the opaque payload the server relays.
#[derive(Clone, Serialize, Deserialize)]
pub struct SenderKeyMessage {
    pub key_id: u32,
    pub iteration: u32,
    pub ciphertext: Vec<u8>,
    pub signature: Vec<u8>,
}

impl SenderKeyMessage {
    pub fn to_bytes(&self) -> Result<Vec<u8>> {
        bincode::serialize(self).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }
    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        bincode::deserialize(data).map_err(|e| CryptoError::DeserializationError(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn distribute(sender: &SenderKey) -> SenderKeyRecord {
        SenderKeyRecord::from_distribution(&sender.distribution_message()).unwrap()
    }

    #[test]
    fn round_trip_single_message() {
        let mut sk = SenderKey::generate(1);
        let mut rec = distribute(&sk);
        let msg = sk.encrypt(b"hello group").unwrap();
        assert_eq!(rec.decrypt(&msg).unwrap(), b"hello group");
    }

    #[test]
    fn in_order_sequence() {
        let mut sk = SenderKey::generate(7);
        let mut rec = distribute(&sk);
        for i in 0..50u32 {
            let pt = format!("msg {i}");
            let ct = sk.encrypt(pt.as_bytes()).unwrap();
            assert_eq!(ct.iteration, i);
            assert_eq!(rec.decrypt(&ct).unwrap(), pt.as_bytes());
        }
    }

    #[test]
    fn out_of_order_delivery() {
        let mut sk = SenderKey::generate(1);
        let mut rec = distribute(&sk);
        let m0 = sk.encrypt(b"zero").unwrap();
        let m1 = sk.encrypt(b"one").unwrap();
        let m2 = sk.encrypt(b"two").unwrap();
        // Deliver 2, then 0, then 1.
        assert_eq!(rec.decrypt(&m2).unwrap(), b"two");
        assert_eq!(rec.decrypt(&m0).unwrap(), b"zero");
        assert_eq!(rec.decrypt(&m1).unwrap(), b"one");
    }

    #[test]
    fn replay_is_rejected() {
        let mut sk = SenderKey::generate(1);
        let mut rec = distribute(&sk);
        let m0 = sk.encrypt(b"once").unwrap();
        assert!(rec.decrypt(&m0).is_ok());
        // Re-delivering the same message must fail (key already consumed).
        assert!(matches!(
            rec.decrypt(&m0),
            Err(CryptoError::DuplicateMessage)
        ));
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let mut sk = SenderKey::generate(1);
        let mut rec = distribute(&sk);
        let mut m = sk.encrypt(b"authentic").unwrap();
        m.ciphertext[0] ^= 0xff; // flip a bit
                                 // Signature covers the ciphertext, so verification fails first.
        assert!(matches!(
            rec.decrypt(&m),
            Err(CryptoError::InvalidSignature)
        ));
    }

    #[test]
    fn forged_signature_fails() {
        let mut sk = SenderKey::generate(1);
        let mut rec = distribute(&sk);
        let mut m = sk.encrypt(b"authentic").unwrap();
        m.signature[0] ^= 0xff;
        assert!(matches!(
            rec.decrypt(&m),
            Err(CryptoError::InvalidSignature)
        ));
    }

    #[test]
    fn wrong_sender_key_cannot_decrypt() {
        let mut sk = SenderKey::generate(1);
        let other = SenderKey::generate(1); // same id, different material
        let mut rec = distribute(&other);
        let m = sk.encrypt(b"secret").unwrap();
        // Signed by `sk`'s signing key, but `rec` has `other`'s verifying key.
        assert!(matches!(
            rec.decrypt(&m),
            Err(CryptoError::InvalidSignature)
        ));
    }

    #[test]
    fn mismatched_key_id_rejected() {
        let mut sk = SenderKey::generate(2);
        let mut rec = distribute(&sk); // record for key_id 2
        let mut m = sk.encrypt(b"x").unwrap();
        m.key_id = 3; // claim a different generation
        assert!(matches!(
            rec.decrypt(&m),
            Err(CryptoError::SessionNotFound(_))
        ));
    }

    #[test]
    fn late_joiner_decrypts_from_current_iteration_only() {
        let mut sk = SenderKey::generate(1);
        // Two messages before the new member joins.
        let _m0 = sk.encrypt(b"before").unwrap();
        let _m1 = sk.encrypt(b"before2").unwrap();
        // New member gets the distribution at the current iteration.
        let mut rec = distribute(&sk);
        let m2 = sk.encrypt(b"after join").unwrap();
        assert_eq!(rec.decrypt(&m2).unwrap(), b"after join");
    }

    #[test]
    fn skip_beyond_max_is_rejected() {
        let mut sk = SenderKey::generate(1);
        let mut rec = distribute(&sk);
        // Fabricate a message far in the future by advancing only the sender.
        let mut last = sk.encrypt(b"first").unwrap();
        for _ in 0..(MAX_SKIP + 5) {
            last = sk.encrypt(b"x").unwrap();
        }
        // rec is still at iteration 0; jumping past MAX_SKIP must be refused.
        assert!(matches!(
            rec.decrypt(&last),
            Err(CryptoError::MessageTooOld)
        ));
    }

    #[test]
    fn sender_key_serialization_round_trip() {
        let mut sk = SenderKey::generate(9);
        let _ = sk.encrypt(b"advance once").unwrap();
        let bytes = sk.to_bytes();
        let restored = SenderKey::from_bytes(&bytes).unwrap();
        assert_eq!(restored.key_id(), 9);
        assert_eq!(restored.iteration, sk.iteration);
        assert_eq!(restored.chain_key.to_bytes(), sk.chain_key.to_bytes());
        assert_eq!(restored.signing_key.to_bytes(), sk.signing_key.to_bytes());
    }

    #[test]
    fn distribution_and_wire_message_serde() {
        let sk = SenderKey::generate(1);
        let dm = sk.distribution_message();
        let dm2 = SenderKeyDistributionMessage::from_bytes(&dm.to_bytes().unwrap()).unwrap();
        assert_eq!(dm.key_id, dm2.key_id);
        assert_eq!(dm.chain_key, dm2.chain_key);

        let mut sk2 = SenderKey::generate(1);
        let m = sk2.encrypt(b"wire").unwrap();
        let m2 = SenderKeyMessage::from_bytes(&m.to_bytes().unwrap()).unwrap();
        assert_eq!(m.iteration, m2.iteration);
        assert_eq!(m.ciphertext, m2.ciphertext);
    }
}
