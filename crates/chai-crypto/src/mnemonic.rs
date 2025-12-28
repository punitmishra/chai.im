//! BIP39 mnemonic generation and identity key derivation.
//!
//! This module provides functionality to:
//! - Generate BIP39 mnemonic phrases (12 or 24 words)
//! - Derive Ed25519 identity keys from mnemonics
//! - Validate mnemonic phrases

use crate::keys::IdentityKeyPair;
use bip39::{Language, Mnemonic};
use hkdf::Hkdf;
use sha2::Sha256;

/// Mnemonic strength (word count).
#[derive(Clone, Copy, Debug)]
pub enum MnemonicStrength {
    /// 12 words (128 bits of entropy)
    Words12 = 128,
    /// 24 words (256 bits of entropy)
    Words24 = 256,
}

impl MnemonicStrength {
    /// Get the word count for this strength.
    pub fn word_count(&self) -> usize {
        match self {
            MnemonicStrength::Words12 => 12,
            MnemonicStrength::Words24 => 24,
        }
    }
}

/// Generate a new BIP39 mnemonic phrase.
///
/// # Arguments
/// * `strength` - The desired mnemonic strength (12 or 24 words)
///
/// # Returns
/// A space-separated string of mnemonic words
pub fn generate_mnemonic(strength: MnemonicStrength) -> String {
    let word_count = strength.word_count();
    let mnemonic = Mnemonic::generate(word_count).expect("Failed to generate mnemonic");
    mnemonic.to_string()
}

/// Validate a mnemonic phrase.
///
/// # Arguments
/// * `words` - Space-separated mnemonic words
///
/// # Returns
/// `true` if the mnemonic is valid, `false` otherwise
pub fn validate_mnemonic(words: &str) -> bool {
    Mnemonic::parse_in_normalized(Language::English, words).is_ok()
}

/// Parse a mnemonic phrase.
///
/// # Arguments
/// * `words` - Space-separated mnemonic words
///
/// # Returns
/// The parsed Mnemonic or an error
pub fn parse_mnemonic(words: &str) -> Result<Mnemonic, bip39::Error> {
    Mnemonic::parse_in_normalized(Language::English, words)
}

/// Derive an Ed25519 identity key pair from a mnemonic.
///
/// Uses HKDF with the mnemonic seed to derive deterministic key material.
/// The derivation path is: mnemonic -> seed -> HKDF -> Ed25519 key
///
/// # Arguments
/// * `mnemonic` - The BIP39 mnemonic
/// * `passphrase` - Optional passphrase for additional security
///
/// # Returns
/// An IdentityKeyPair derived from the mnemonic
pub fn derive_identity_from_mnemonic(mnemonic: &Mnemonic, passphrase: &str) -> IdentityKeyPair {
    // Generate seed from mnemonic (64 bytes)
    let seed = mnemonic.to_seed(passphrase);

    // Use HKDF to derive 32 bytes for Ed25519 key
    // Info string identifies this as a Chai identity key derivation
    let hk = Hkdf::<Sha256>::new(Some(b"chai.im-identity-v1"), &seed);
    let mut key_bytes = [0u8; 32];
    hk.expand(b"ed25519-identity", &mut key_bytes)
        .expect("HKDF output length is valid");

    IdentityKeyPair::from_bytes(&key_bytes)
}

/// Derive an identity key pair directly from mnemonic words.
///
/// Convenience function that combines parsing and derivation.
///
/// # Arguments
/// * `words` - Space-separated mnemonic words
/// * `passphrase` - Optional passphrase for additional security
///
/// # Returns
/// An IdentityKeyPair or an error if the mnemonic is invalid
pub fn derive_identity_from_words(
    words: &str,
    passphrase: &str,
) -> Result<IdentityKeyPair, bip39::Error> {
    let mnemonic = parse_mnemonic(words)?;
    Ok(derive_identity_from_mnemonic(&mnemonic, passphrase))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_mnemonic_12_words() {
        let mnemonic = generate_mnemonic(MnemonicStrength::Words12);
        let word_count = mnemonic.split_whitespace().count();
        assert_eq!(word_count, 12);
        assert!(validate_mnemonic(&mnemonic));
    }

    #[test]
    fn test_generate_mnemonic_24_words() {
        let mnemonic = generate_mnemonic(MnemonicStrength::Words24);
        let word_count = mnemonic.split_whitespace().count();
        assert_eq!(word_count, 24);
        assert!(validate_mnemonic(&mnemonic));
    }

    #[test]
    fn test_validate_mnemonic() {
        // Valid 12-word mnemonic
        let valid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        assert!(validate_mnemonic(valid));

        // Invalid mnemonic
        assert!(!validate_mnemonic("invalid words here that are not a real mnemonic"));

        // Invalid checksum
        assert!(!validate_mnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"));
    }

    #[test]
    fn test_deterministic_derivation() {
        let words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = parse_mnemonic(words).unwrap();

        let identity1 = derive_identity_from_mnemonic(&mnemonic, "");
        let identity2 = derive_identity_from_mnemonic(&mnemonic, "");

        assert_eq!(identity1.to_bytes(), identity2.to_bytes());
        assert_eq!(
            identity1.public_key().to_bytes(),
            identity2.public_key().to_bytes()
        );
    }

    #[test]
    fn test_passphrase_changes_key() {
        let words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = parse_mnemonic(words).unwrap();

        let identity1 = derive_identity_from_mnemonic(&mnemonic, "");
        let identity2 = derive_identity_from_mnemonic(&mnemonic, "secret passphrase");

        assert_ne!(identity1.to_bytes(), identity2.to_bytes());
    }

    #[test]
    fn test_derive_identity_from_words() {
        let words = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

        let identity = derive_identity_from_words(words, "").unwrap();

        // Should be able to sign and verify
        let message = b"test message";
        let signature = identity.sign(message);
        assert!(identity.public_key().verify(message, &signature).is_ok());
    }

    #[test]
    fn test_different_mnemonics_different_keys() {
        let mnemonic1 = generate_mnemonic(MnemonicStrength::Words12);
        let mnemonic2 = generate_mnemonic(MnemonicStrength::Words12);

        let identity1 = derive_identity_from_words(&mnemonic1, "").unwrap();
        let identity2 = derive_identity_from_words(&mnemonic2, "").unwrap();

        assert_ne!(identity1.to_bytes(), identity2.to_bytes());
    }
}
