//! X3DH (Extended Triple Diffie-Hellman) key agreement.
//!
//! Implements the Signal Protocol's X3DH for establishing shared secrets.

use crate::keys::{DHKeyPair, IdentityKeyPair, OneTimePreKey, PreKeyBundle, SignedPreKey};
use crate::{CryptoError, Result};
use hkdf::Hkdf;
use sha2::Sha256;
use x25519_dalek::PublicKey as X25519PublicKey;
use zeroize::Zeroize;

/// Info string for HKDF.
const X3DH_INFO: &[u8] = b"Chai.im X3DH";

/// Shared secret derived from X3DH.
#[derive(Clone, Zeroize)]
#[zeroize(drop)]
pub struct SharedSecret(pub [u8; 32]);

impl SharedSecret {
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

/// X3DH sender (initiator) state.
pub struct X3DHSender {
    /// Our identity key pair.
    identity: IdentityKeyPair,
}

impl X3DHSender {
    pub fn new(identity: IdentityKeyPair) -> Self {
        Self { identity }
    }

    /// Perform X3DH as the sender (initiator).
    ///
    /// Returns the shared secret and the initial message to send.
    pub fn initiate(
        &self,
        their_bundle: &PreKeyBundle,
    ) -> Result<(SharedSecret, X3DHInitialMessage)> {
        // Verify the bundle's signature
        their_bundle.verify()?;

        // Generate ephemeral key pair
        let ephemeral = DHKeyPair::generate();

        // Get their keys
        let their_identity_dh = their_bundle.identity_key.dh_public_key();
        let their_signed_prekey = their_bundle.signed_prekey_public();
        let their_one_time_prekey = their_bundle.one_time_prekey_public();

        // Perform DH calculations
        // DH1 = DH(IK_A, SPK_B)
        let dh1 = self.identity_dh_with(&their_signed_prekey);

        // DH2 = DH(EK_A, IK_B)
        let dh2 = ephemeral.diffie_hellman(&their_identity_dh);

        // DH3 = DH(EK_A, SPK_B)
        let dh3 = ephemeral.diffie_hellman(&their_signed_prekey);

        // DH4 = DH(EK_A, OPK_B) if available
        let dh4 = their_one_time_prekey.map(|opk| ephemeral.diffie_hellman(&opk));

        // Derive shared secret
        let shared_secret = derive_shared_secret(&dh1, &dh2, &dh3, dh4.as_ref())?;

        // Create initial message
        let initial_message = X3DHInitialMessage {
            identity_key: self.identity.public_key().to_bytes(),
            ephemeral_key: ephemeral.public_key().to_bytes(),
            signed_prekey_id: their_bundle.signed_prekey_id,
            one_time_prekey_id: their_bundle.one_time_prekey_id,
        };

        Ok((shared_secret, initial_message))
    }

    /// Perform DH between our identity key and their public key.
    fn identity_dh_with(&self, their_public: &X25519PublicKey) -> [u8; 32] {
        let secret = self.identity.dh_secret();
        secret.diffie_hellman(their_public).to_bytes()
    }
}

/// X3DH receiver state.
pub struct X3DHReceiver {
    /// Our identity key pair.
    #[allow(dead_code)]
    identity: IdentityKeyPair,
    /// Our signed prekey.
    signed_prekey: SignedPreKey,
    /// Our one-time prekeys (indexed by ID).
    one_time_prekeys: Vec<OneTimePreKey>,
}

impl X3DHReceiver {
    pub fn new(
        identity: IdentityKeyPair,
        signed_prekey: SignedPreKey,
        one_time_prekeys: Vec<OneTimePreKey>,
    ) -> Self {
        Self {
            identity,
            signed_prekey,
            one_time_prekeys,
        }
    }

    /// Process an X3DH initial message from a sender.
    pub fn receive(&mut self, message: &X3DHInitialMessage) -> Result<SharedSecret> {
        // Find the one-time prekey if used
        let one_time_prekey = message.one_time_prekey_id.and_then(|id| {
            self.one_time_prekeys
                .iter()
                .position(|k| k.id == id)
                .map(|idx| {
                    self.one_time_prekeys.remove(idx) // Consume the one-time prekey
                })
        });

        // Get their keys - identity_key is Ed25519, convert to X25519 for DH
        let their_identity_pub = crate::keys::IdentityPublicKey::from_bytes(&message.identity_key)
            .map_err(|_| CryptoError::InvalidKeyLength {
                expected: 32,
                actual: message.identity_key.len(),
            })?;
        let their_identity = their_identity_pub.dh_public_key();
        let their_ephemeral = X25519PublicKey::from(message.ephemeral_key);

        // Perform DH calculations (mirror of sender)
        // DH1 = DH(SPK_B, IK_A)
        let dh1 = self.signed_prekey.key_pair.diffie_hellman(&their_identity);

        // DH2 = DH(IK_B, EK_A)
        let dh2 = self.identity_dh_with(&their_ephemeral);

        // DH3 = DH(SPK_B, EK_A)
        let dh3 = self.signed_prekey.key_pair.diffie_hellman(&their_ephemeral);

        // DH4 = DH(OPK_B, EK_A) if used
        let dh4 = one_time_prekey.map(|opk| opk.key_pair.diffie_hellman(&their_ephemeral));

        // Derive shared secret
        derive_shared_secret(&dh1, &dh2, &dh3, dh4.as_ref())
    }

    /// Perform DH between our identity key and their public key.
    fn identity_dh_with(&self, their_public: &X25519PublicKey) -> [u8; 32] {
        let secret = self.identity.dh_secret();
        secret.diffie_hellman(their_public).to_bytes()
    }
}

/// Initial message sent from X3DH sender to receiver.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct X3DHInitialMessage {
    /// Sender's identity public key.
    pub identity_key: [u8; 32],
    /// Sender's ephemeral public key.
    pub ephemeral_key: [u8; 32],
    /// ID of the signed prekey used.
    pub signed_prekey_id: u32,
    /// ID of the one-time prekey used (if any).
    pub one_time_prekey_id: Option<u32>,
}

/// Derive shared secret from DH outputs using HKDF.
fn derive_shared_secret(
    dh1: &[u8; 32],
    dh2: &[u8; 32],
    dh3: &[u8; 32],
    dh4: Option<&[u8; 32]>,
) -> Result<SharedSecret> {
    // Concatenate DH outputs
    let mut input = Vec::with_capacity(32 * 4);
    // Add 32 0xFF bytes as specified in Signal Protocol
    input.extend_from_slice(&[0xFF; 32]);
    input.extend_from_slice(dh1);
    input.extend_from_slice(dh2);
    input.extend_from_slice(dh3);
    if let Some(dh4) = dh4 {
        input.extend_from_slice(dh4);
    }

    // Use HKDF to derive the shared secret
    let hk = Hkdf::<Sha256>::new(None, &input);
    let mut shared_secret = [0u8; 32];
    hk.expand(X3DH_INFO, &mut shared_secret)
        .map_err(|_| CryptoError::KeyDerivationFailed("HKDF expand failed".into()))?;

    // Zeroize input
    input.zeroize();

    Ok(SharedSecret(shared_secret))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_x3dh_key_agreement() {
        // Bob (receiver) generates keys
        let bob_identity = IdentityKeyPair::generate();
        let bob_signed_prekey = SignedPreKey::generate(1, &bob_identity);
        let bob_one_time = OneTimePreKey::generate(1);

        // Bob publishes his bundle
        let bob_bundle = PreKeyBundle::new(&bob_identity, &bob_signed_prekey, Some(&bob_one_time));

        // Alice (sender) initiates
        let alice_identity = IdentityKeyPair::generate();
        let alice_sender = X3DHSender::new(alice_identity);

        let (alice_secret, initial_message) = alice_sender.initiate(&bob_bundle).unwrap();

        // Bob receives
        let mut bob_receiver =
            X3DHReceiver::new(bob_identity, bob_signed_prekey, vec![bob_one_time]);

        let bob_secret = bob_receiver.receive(&initial_message).unwrap();

        // Both should derive the same shared secret
        assert_eq!(alice_secret.as_bytes(), bob_secret.as_bytes());
    }
}
