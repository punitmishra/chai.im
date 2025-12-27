//! Double Ratchet algorithm implementation.
//!
//! Provides forward secrecy and break-in recovery for encrypted messaging.

use crate::cipher::{decrypt_with_ad, encrypt_with_ad};
use crate::keys::DHKeyPair;
use crate::x3dh::SharedSecret;
use crate::{CryptoError, Result};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use x25519_dalek::PublicKey as X25519PublicKey;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Maximum number of skipped message keys to store.
const MAX_SKIP: u32 = 1000;

/// Chain key for deriving message keys.
#[derive(Clone, Zeroize, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct ChainKey([u8; 32]);

impl ChainKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Derive the next chain key and message key.
    pub fn advance(&self) -> (ChainKey, MessageKey) {
        type HmacSha256 = Hmac<Sha256>;

        // Chain key = HMAC(CK, 0x02)
        let mut mac = HmacSha256::new_from_slice(&self.0).expect("HMAC key size");
        mac.update(&[0x02]);
        let next_chain: [u8; 32] = mac.finalize().into_bytes().into();

        // Message key = HMAC(CK, 0x01)
        let mut mac = HmacSha256::new_from_slice(&self.0).expect("HMAC key size");
        mac.update(&[0x01]);
        let message: [u8; 32] = mac.finalize().into_bytes().into();

        (ChainKey(next_chain), MessageKey(message))
    }
}

/// Message key for encrypting/decrypting a single message.
#[derive(Clone, Zeroize, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct MessageKey([u8; 32]);

impl MessageKey {
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

/// Root key for deriving new chain keys during DH ratchet.
#[derive(Clone, Zeroize, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct RootKey([u8; 32]);

impl RootKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Perform a root key ratchet step.
    pub fn ratchet(&self, dh_output: &[u8; 32]) -> (RootKey, ChainKey) {
        let hk = Hkdf::<Sha256>::new(Some(&self.0), dh_output);
        let mut output = [0u8; 64];
        hk.expand(b"Chai.im Ratchet", &mut output)
            .expect("HKDF expand");

        let mut root = [0u8; 32];
        let mut chain = [0u8; 32];
        root.copy_from_slice(&output[..32]);
        chain.copy_from_slice(&output[32..]);

        (RootKey(root), ChainKey(chain))
    }
}

/// Message header containing DH ratchet information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageHeader {
    /// Current DH ratchet public key.
    pub dh_public: [u8; 32],
    /// Previous chain message count.
    pub previous_counter: u32,
    /// Current message number in chain.
    pub message_number: u32,
}

impl MessageHeader {
    /// Serialize header for use as associated data.
    pub fn to_bytes(&self) -> Vec<u8> {
        bincode::serialize(self).expect("header serialization")
    }

    /// Deserialize header.
    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        bincode::deserialize(data).map_err(|e| CryptoError::DeserializationError(e.to_string()))
    }
}

/// Double Ratchet state machine.
#[derive(Serialize, Deserialize)]
pub struct DoubleRatchet {
    /// Current DH key pair (for sending).
    #[serde(skip)]
    dh_self: Option<DHKeyPair>,
    /// Serialized DH self for storage.
    dh_self_bytes: Option<[u8; 32]>,
    /// Their current DH public key.
    dh_remote: Option<[u8; 32]>,
    /// Root key.
    root_key: RootKey,
    /// Sending chain key.
    chain_key_send: Option<ChainKey>,
    /// Receiving chain key.
    chain_key_recv: Option<ChainKey>,
    /// Sending message counter.
    send_counter: u32,
    /// Receiving message counter.
    recv_counter: u32,
    /// Previous sending chain length.
    previous_counter: u32,
    /// Skipped message keys: (dh_public, message_number) -> MessageKey.
    skipped_keys: HashMap<([u8; 32], u32), MessageKey>,
}

impl DoubleRatchet {
    /// Initialize as the sender (after X3DH).
    pub fn init_sender(shared_secret: SharedSecret, their_dh_public: [u8; 32]) -> Self {
        let dh_self = DHKeyPair::generate();
        let their_public = X25519PublicKey::from(their_dh_public);

        // First DH ratchet
        let dh_output = dh_self.diffie_hellman(&their_public);
        let root_key = RootKey::from_bytes(*shared_secret.as_bytes());
        let (root_key, chain_key_send) = root_key.ratchet(&dh_output);

        Self {
            dh_self_bytes: Some(dh_self.secret_bytes()),
            dh_self: Some(dh_self),
            dh_remote: Some(their_dh_public),
            root_key,
            chain_key_send: Some(chain_key_send),
            chain_key_recv: None,
            send_counter: 0,
            recv_counter: 0,
            previous_counter: 0,
            skipped_keys: HashMap::new(),
        }
    }

    /// Initialize as the receiver (after X3DH).
    pub fn init_receiver(shared_secret: SharedSecret, our_dh: DHKeyPair) -> Self {
        Self {
            dh_self_bytes: Some(our_dh.secret_bytes()),
            dh_self: Some(our_dh),
            dh_remote: None,
            root_key: RootKey::from_bytes(*shared_secret.as_bytes()),
            chain_key_send: None,
            chain_key_recv: None,
            send_counter: 0,
            recv_counter: 0,
            previous_counter: 0,
            skipped_keys: HashMap::new(),
        }
    }

    /// Encrypt a message.
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<(MessageHeader, Vec<u8>)> {
        let dh_self = self
            .dh_self
            .as_ref()
            .ok_or(CryptoError::SessionNotInitialized)?;
        let chain_key = self
            .chain_key_send
            .as_ref()
            .ok_or(CryptoError::SessionNotInitialized)?;

        // Advance chain
        let (next_chain, message_key) = chain_key.advance();
        self.chain_key_send = Some(next_chain);

        // Create header
        let header = MessageHeader {
            dh_public: dh_self.public_key().to_bytes(),
            previous_counter: self.previous_counter,
            message_number: self.send_counter,
        };

        // Encrypt with header as associated data
        let ad = header.to_bytes();
        let ciphertext = encrypt_with_ad(message_key.as_bytes(), plaintext, &ad)?;

        self.send_counter = self
            .send_counter
            .checked_add(1)
            .ok_or(CryptoError::CounterOverflow)?;

        Ok((header, ciphertext))
    }

    /// Decrypt a message.
    pub fn decrypt(&mut self, header: &MessageHeader, ciphertext: &[u8]) -> Result<Vec<u8>> {
        // Check for skipped message key
        let skipped_key = self
            .skipped_keys
            .remove(&(header.dh_public, header.message_number));
        if let Some(message_key) = skipped_key {
            let ad = header.to_bytes();
            return decrypt_with_ad(message_key.as_bytes(), ciphertext, &ad);
        }

        // Check if we need to perform a DH ratchet
        if self.dh_remote.as_ref() != Some(&header.dh_public) {
            self.skip_message_keys(header.previous_counter)?;
            self.dh_ratchet(&header.dh_public)?;
        }

        // Skip ahead if needed
        self.skip_message_keys(header.message_number)?;

        // Advance receiving chain
        let chain_key = self
            .chain_key_recv
            .as_ref()
            .ok_or(CryptoError::SessionNotInitialized)?;
        let (next_chain, message_key) = chain_key.advance();
        self.chain_key_recv = Some(next_chain);
        self.recv_counter = header
            .message_number
            .checked_add(1)
            .ok_or(CryptoError::CounterOverflow)?;

        // Decrypt
        let ad = header.to_bytes();
        decrypt_with_ad(message_key.as_bytes(), ciphertext, &ad)
    }

    /// Skip message keys up to the given counter.
    fn skip_message_keys(&mut self, until: u32) -> Result<()> {
        if self.chain_key_recv.is_none() {
            return Ok(());
        }

        if until.saturating_sub(self.recv_counter) > MAX_SKIP {
            return Err(CryptoError::MessageTooOld);
        }

        let dh_remote = self.dh_remote.ok_or(CryptoError::SessionNotInitialized)?;

        while self.recv_counter < until {
            let chain_key = self
                .chain_key_recv
                .as_ref()
                .ok_or(CryptoError::SessionNotInitialized)?;
            let (next_chain, message_key) = chain_key.advance();
            self.chain_key_recv = Some(next_chain);

            self.skipped_keys
                .insert((dh_remote, self.recv_counter), message_key);
            self.recv_counter = self
                .recv_counter
                .checked_add(1)
                .ok_or(CryptoError::CounterOverflow)?;

            // Limit skipped keys storage
            if self.skipped_keys.len() > MAX_SKIP as usize {
                // Remove oldest (this is a simplified approach)
                if let Some(key) = self.skipped_keys.keys().next().cloned() {
                    self.skipped_keys.remove(&key);
                }
            }
        }

        Ok(())
    }

    /// Perform a DH ratchet step.
    fn dh_ratchet(&mut self, their_new_public: &[u8; 32]) -> Result<()> {
        self.previous_counter = self.send_counter;
        self.send_counter = 0;
        self.recv_counter = 0;

        self.dh_remote = Some(*their_new_public);
        let their_public = X25519PublicKey::from(*their_new_public);

        // Derive receiving chain
        let dh_self = self
            .dh_self
            .as_ref()
            .ok_or(CryptoError::SessionNotInitialized)?;
        let dh_output = dh_self.diffie_hellman(&their_public);
        let (root_key, chain_key_recv) = self.root_key.ratchet(&dh_output);
        self.root_key = root_key;
        self.chain_key_recv = Some(chain_key_recv);

        // Generate new DH key pair
        let new_dh = DHKeyPair::generate();
        let dh_output = new_dh.diffie_hellman(&their_public);
        let (root_key, chain_key_send) = self.root_key.ratchet(&dh_output);
        self.root_key = root_key;
        self.chain_key_send = Some(chain_key_send);
        self.dh_self_bytes = Some(new_dh.secret_bytes());
        self.dh_self = Some(new_dh);

        Ok(())
    }

    /// Get our current DH public key.
    pub fn our_public_key(&self) -> Option<[u8; 32]> {
        self.dh_self.as_ref().map(|k| k.public_key().to_bytes())
    }

    /// Restore DH key pair from bytes (after deserialization).
    pub fn restore_keys(&mut self) {
        if let Some(bytes) = self.dh_self_bytes {
            self.dh_self = Some(DHKeyPair::from_secret_bytes(bytes));
        }
    }

    /// Export state for storage.
    pub fn export(&self) -> Result<Vec<u8>> {
        bincode::serialize(self).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }

    /// Import state from storage.
    pub fn import(data: &[u8]) -> Result<Self> {
        let mut state: Self = bincode::deserialize(data)
            .map_err(|e| CryptoError::DeserializationError(e.to_string()))?;
        state.restore_keys();
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_key_advance() {
        let chain = ChainKey::from_bytes([0x42; 32]);
        let (next_chain, message_key) = chain.advance();

        // Verify deterministic derivation
        let (next_chain2, message_key2) = chain.advance();
        assert_eq!(next_chain.0, next_chain2.0);
        assert_eq!(message_key.0, message_key2.0);
    }

    #[test]
    fn test_root_key_ratchet() {
        let root = RootKey::from_bytes([0x42; 32]);
        let dh_output = [0x43; 32];

        let (new_root, chain) = root.ratchet(&dh_output);

        // Verify deterministic
        let (new_root2, chain2) = root.ratchet(&dh_output);
        assert_eq!(new_root.0, new_root2.0);
        assert_eq!(chain.0, chain2.0);

        // Verify different from original
        assert_ne!(root.0, new_root.0);
    }

    #[test]
    fn test_double_ratchet_roundtrip() {
        let shared_secret = SharedSecret([0x42; 32]);

        // Bob's initial DH key (simulating signed prekey)
        let bob_dh = DHKeyPair::generate();
        let bob_public = bob_dh.public_key().to_bytes();

        // Alice (sender) initializes
        let mut alice = DoubleRatchet::init_sender(SharedSecret([0x42; 32]), bob_public);

        // Bob (receiver) initializes
        let mut bob = DoubleRatchet::init_receiver(shared_secret, bob_dh);

        // Alice sends a message
        let plaintext = b"Hello, Bob!";
        let (header, ciphertext) = alice.encrypt(plaintext).unwrap();

        // Bob decrypts
        let decrypted = bob.decrypt(&header, &ciphertext).unwrap();
        assert_eq!(plaintext.as_slice(), decrypted.as_slice());

        // Bob replies
        let reply = b"Hello, Alice!";
        let (header2, ciphertext2) = bob.encrypt(reply).unwrap();

        // Alice decrypts
        let decrypted2 = alice.decrypt(&header2, &ciphertext2).unwrap();
        assert_eq!(reply.as_slice(), decrypted2.as_slice());
    }
}
