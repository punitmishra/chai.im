//! Chai.im cryptographic library implementing the Signal Protocol.
//!
//! This crate provides end-to-end encryption using:
//! - X3DH (Extended Triple Diffie-Hellman) for key agreement
//! - Double Ratchet for forward-secure messaging
//! - AES-256-GCM for authenticated encryption

pub mod error;
pub mod keys;
pub mod x3dh;
pub mod ratchet;
pub mod session;
pub mod cipher;

#[cfg(feature = "wasm")]
pub mod wasm;

pub use error::CryptoError;
pub use keys::{IdentityKeyPair, SignedPreKey, OneTimePreKey, PreKeyBundle};
pub use x3dh::{X3DHSender, X3DHReceiver};
pub use ratchet::DoubleRatchet;
pub use session::{Session, SessionManager};
pub use cipher::{encrypt, decrypt};

/// Result type for cryptographic operations.
pub type Result<T> = std::result::Result<T, CryptoError>;
