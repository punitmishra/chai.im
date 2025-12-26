//! Key types for the Signal Protocol.

use crate::{CryptoError, Result};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use x25519_dalek::{PublicKey as X25519PublicKey, StaticSecret};
use zeroize::ZeroizeOnDrop;

/// Identity key pair (Ed25519 for signing).
#[derive(Clone, ZeroizeOnDrop)]
pub struct IdentityKeyPair {
    #[zeroize(skip)]
    signing_key: SigningKey,
}

impl IdentityKeyPair {
    /// Generate a new random identity key pair.
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        Self { signing_key }
    }

    /// Get the public identity key.
    pub fn public_key(&self) -> IdentityPublicKey {
        IdentityPublicKey(self.signing_key.verifying_key())
    }

    /// Sign a message.
    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        self.signing_key.sign(message).to_bytes().to_vec()
    }

    /// Export to bytes for storage.
    pub fn to_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }

    /// Import from bytes.
    pub fn from_bytes(bytes: &[u8; 32]) -> Self {
        Self {
            signing_key: SigningKey::from_bytes(bytes),
        }
    }

    /// Get the X25519 public key derived from this identity key.
    /// Used for DH operations in X3DH.
    pub fn dh_public_key(&self) -> X25519PublicKey {
        // Convert Ed25519 to X25519 using the standard conversion
        let ed_public = self.signing_key.verifying_key();
        let montgomery = ed_public.to_montgomery();
        X25519PublicKey::from(montgomery.to_bytes())
    }
}

/// Public identity key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct IdentityPublicKey(#[serde(with = "verifying_key_serde")] VerifyingKey);

impl IdentityPublicKey {
    /// Verify a signature.
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> Result<()> {
        if signature.len() != 64 {
            return Err(CryptoError::InvalidSignature);
        }
        let sig_bytes: [u8; 64] = signature.try_into().unwrap();
        let signature = Signature::from_bytes(&sig_bytes);
        self.0
            .verify(message, &signature)
            .map_err(|_| CryptoError::InvalidSignature)
    }

    /// Export to bytes.
    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.to_bytes()
    }

    /// Import from bytes.
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self> {
        VerifyingKey::from_bytes(bytes)
            .map(Self)
            .map_err(|_| CryptoError::InvalidKeyLength {
                expected: 32,
                actual: bytes.len(),
            })
    }

    /// Get the X25519 public key for DH operations.
    pub fn dh_public_key(&self) -> X25519PublicKey {
        let montgomery = self.0.to_montgomery();
        X25519PublicKey::from(montgomery.to_bytes())
    }
}

mod verifying_key_serde {
    use super::*;
    use serde::{de, Deserializer, Serializer};

    pub fn serialize<S>(key: &VerifyingKey, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&key.to_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> std::result::Result<VerifyingKey, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = Deserialize::deserialize(deserializer)?;
        if bytes.len() != 32 {
            return Err(de::Error::custom("invalid key length"));
        }
        let arr: [u8; 32] = bytes.try_into().unwrap();
        VerifyingKey::from_bytes(&arr).map_err(de::Error::custom)
    }
}

/// X25519 key pair for Diffie-Hellman.
#[derive(Clone, ZeroizeOnDrop)]
pub struct DHKeyPair {
    secret: StaticSecret,
    #[zeroize(skip)]
    public: X25519PublicKey,
}

impl DHKeyPair {
    /// Generate a new random DH key pair.
    pub fn generate() -> Self {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = X25519PublicKey::from(&secret);
        Self { secret, public }
    }

    /// Get the public key.
    pub fn public_key(&self) -> X25519PublicKey {
        self.public
    }

    /// Perform Diffie-Hellman with another public key.
    pub fn diffie_hellman(&self, their_public: &X25519PublicKey) -> [u8; 32] {
        self.secret.diffie_hellman(their_public).to_bytes()
    }

    /// Export secret to bytes.
    pub fn secret_bytes(&self) -> [u8; 32] {
        // Note: This is sensitive - handle with care
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(self.secret.as_bytes());
        bytes
    }

    /// Import from secret bytes.
    pub fn from_secret_bytes(bytes: [u8; 32]) -> Self {
        let secret = StaticSecret::from(bytes);
        let public = X25519PublicKey::from(&secret);
        Self { secret, public }
    }
}

/// Signed prekey for X3DH.
#[derive(Clone)]
pub struct SignedPreKey {
    pub id: u32,
    pub key_pair: DHKeyPair,
    pub signature: Vec<u8>,
}

impl SignedPreKey {
    /// Generate a new signed prekey.
    pub fn generate(id: u32, identity: &IdentityKeyPair) -> Self {
        let key_pair = DHKeyPair::generate();
        let signature = identity.sign(key_pair.public_key().as_bytes());
        Self {
            id,
            key_pair,
            signature,
        }
    }

    /// Get the public key.
    pub fn public_key(&self) -> X25519PublicKey {
        self.key_pair.public_key()
    }
}

/// One-time prekey for X3DH.
#[derive(Clone)]
pub struct OneTimePreKey {
    pub id: u32,
    pub key_pair: DHKeyPair,
}

impl OneTimePreKey {
    /// Generate a new one-time prekey.
    pub fn generate(id: u32) -> Self {
        Self {
            id,
            key_pair: DHKeyPair::generate(),
        }
    }

    /// Get the public key.
    pub fn public_key(&self) -> X25519PublicKey {
        self.key_pair.public_key()
    }
}

/// Public prekey bundle for X3DH key agreement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreKeyBundle {
    pub identity_key: IdentityPublicKey,
    pub signed_prekey: [u8; 32],
    pub signed_prekey_id: u32,
    pub signed_prekey_signature: Vec<u8>,
    pub one_time_prekey: Option<[u8; 32]>,
    pub one_time_prekey_id: Option<u32>,
}

impl PreKeyBundle {
    /// Create a bundle from key components.
    pub fn new(
        identity: &IdentityKeyPair,
        signed_prekey: &SignedPreKey,
        one_time_prekey: Option<&OneTimePreKey>,
    ) -> Self {
        Self {
            identity_key: identity.public_key(),
            signed_prekey: signed_prekey.public_key().to_bytes(),
            signed_prekey_id: signed_prekey.id,
            signed_prekey_signature: signed_prekey.signature.clone(),
            one_time_prekey: one_time_prekey.map(|k| k.public_key().to_bytes()),
            one_time_prekey_id: one_time_prekey.map(|k| k.id),
        }
    }

    /// Verify the signed prekey signature.
    pub fn verify(&self) -> Result<()> {
        self.identity_key
            .verify(&self.signed_prekey, &self.signed_prekey_signature)
    }

    /// Get the signed prekey as X25519 public key.
    pub fn signed_prekey_public(&self) -> X25519PublicKey {
        X25519PublicKey::from(self.signed_prekey)
    }

    /// Get the one-time prekey as X25519 public key.
    pub fn one_time_prekey_public(&self) -> Option<X25519PublicKey> {
        self.one_time_prekey.map(X25519PublicKey::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_key_sign_verify() {
        let identity = IdentityKeyPair::generate();
        let message = b"hello world";
        let signature = identity.sign(message);

        let public = identity.public_key();
        assert!(public.verify(message, &signature).is_ok());

        // Verify wrong message fails
        assert!(public.verify(b"wrong message", &signature).is_err());
    }

    #[test]
    fn test_dh_key_exchange() {
        let alice = DHKeyPair::generate();
        let bob = DHKeyPair::generate();

        let alice_shared = alice.diffie_hellman(&bob.public_key());
        let bob_shared = bob.diffie_hellman(&alice.public_key());

        assert_eq!(alice_shared, bob_shared);
    }

    #[test]
    fn test_prekey_bundle_verification() {
        let identity = IdentityKeyPair::generate();
        let signed_prekey = SignedPreKey::generate(1, &identity);
        let one_time = OneTimePreKey::generate(1);

        let bundle = PreKeyBundle::new(&identity, &signed_prekey, Some(&one_time));
        assert!(bundle.verify().is_ok());
    }
}
