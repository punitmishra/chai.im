//! Symmetric encryption using AES-256-GCM.

use crate::{CryptoError, Result};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

/// Encrypt plaintext using AES-256-GCM.
///
/// Returns: nonce (12 bytes) || ciphertext || tag (16 bytes)
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::InvalidKeyLength { expected: 32, actual: key.len() })?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(12 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypt ciphertext using AES-256-GCM.
///
/// Input format: nonce (12 bytes) || ciphertext || tag (16 bytes)
pub fn decrypt(key: &[u8; 32], ciphertext: &[u8]) -> Result<Vec<u8>> {
    if ciphertext.len() < 12 + 16 {
        return Err(CryptoError::DecryptionFailed);
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::InvalidKeyLength { expected: 32, actual: key.len() })?;

    let nonce = Nonce::from_slice(&ciphertext[..12]);
    let ciphertext = &ciphertext[12..];

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)
}

/// Encrypt with associated data (AEAD).
pub fn encrypt_with_ad(key: &[u8; 32], plaintext: &[u8], ad: &[u8]) -> Result<Vec<u8>> {
    use aes_gcm::aead::Payload;

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::InvalidKeyLength { expected: 32, actual: key.len() })?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let payload = Payload { msg: plaintext, aad: ad };
    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let mut result = Vec::with_capacity(12 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Decrypt with associated data (AEAD).
pub fn decrypt_with_ad(key: &[u8; 32], ciphertext: &[u8], ad: &[u8]) -> Result<Vec<u8>> {
    use aes_gcm::aead::Payload;

    if ciphertext.len() < 12 + 16 {
        return Err(CryptoError::DecryptionFailed);
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CryptoError::InvalidKeyLength { expected: 32, actual: key.len() })?;

    let nonce = Nonce::from_slice(&ciphertext[..12]);
    let payload = Payload {
        msg: &ciphertext[12..],
        aad: ad,
    };

    cipher
        .decrypt(nonce, payload)
        .map_err(|_| CryptoError::DecryptionFailed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = [0x42u8; 32];
        let plaintext = b"Hello, World!";

        let ciphertext = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &ciphertext).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_encrypt_decrypt_with_ad() {
        let key = [0x42u8; 32];
        let plaintext = b"Secret message";
        let ad = b"associated data";

        let ciphertext = encrypt_with_ad(&key, plaintext, ad).unwrap();
        let decrypted = decrypt_with_ad(&key, &ciphertext, ad).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());

        // Wrong AD should fail
        assert!(decrypt_with_ad(&key, &ciphertext, b"wrong ad").is_err());
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = [0x42u8; 32];
        let key2 = [0x43u8; 32];
        let plaintext = b"Secret";

        let ciphertext = encrypt(&key1, plaintext).unwrap();
        assert!(decrypt(&key2, &ciphertext).is_err());
    }
}
