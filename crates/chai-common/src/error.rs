//! Common error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ChaiError {
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("User not found: {0}")]
    UserNotFound(String),

    #[error("Invalid message format: {0}")]
    InvalidMessage(String),

    #[error("Cryptographic error: {0}")]
    CryptoError(String),

    #[error("Session not found for peer: {0}")]
    SessionNotFound(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}
