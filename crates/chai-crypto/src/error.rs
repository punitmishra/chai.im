//! Cryptographic error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Invalid key length: expected {expected}, got {actual}")]
    InvalidKeyLength { expected: usize, actual: usize },

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Decryption failed")]
    DecryptionFailed,

    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),

    #[error("Session not initialized")]
    SessionNotInitialized,

    #[error("Session not found for peer: {0}")]
    SessionNotFound(String),

    #[error("Message counter overflow")]
    CounterOverflow,

    #[error("Duplicate message detected")]
    DuplicateMessage,

    #[error("Message too old (skipped key limit exceeded)")]
    MessageTooOld,

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Deserialization error: {0}")]
    DeserializationError(String),

    #[error("Random number generation failed")]
    RngError,
}
