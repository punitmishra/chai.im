//! Wire format serialization/deserialization.

use crate::messages::{ClientMessage, ServerMessage};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WireError {
    #[error("Serialization error: {0}")]
    Serialization(String),
    #[error("Deserialization error: {0}")]
    Deserialization(String),
}

/// Encode a client message to bytes.
pub fn encode_client_message(msg: &ClientMessage) -> Result<Vec<u8>, WireError> {
    bincode::serialize(msg).map_err(|e| WireError::Serialization(e.to_string()))
}

/// Decode a client message from bytes.
pub fn decode_client_message(data: &[u8]) -> Result<ClientMessage, WireError> {
    bincode::deserialize(data).map_err(|e| WireError::Deserialization(e.to_string()))
}

/// Encode a server message to bytes.
pub fn encode_server_message(msg: &ServerMessage) -> Result<Vec<u8>, WireError> {
    bincode::serialize(msg).map_err(|e| WireError::Serialization(e.to_string()))
}

/// Decode a server message from bytes.
pub fn decode_server_message(data: &[u8]) -> Result<ServerMessage, WireError> {
    bincode::deserialize(data).map_err(|e| WireError::Deserialization(e.to_string()))
}

/// JSON encoding for web clients.
pub mod json {
    use super::*;
    use serde_json;

    pub fn encode_client_message(msg: &ClientMessage) -> Result<String, WireError> {
        serde_json::to_string(msg).map_err(|e| WireError::Serialization(e.to_string()))
    }

    pub fn decode_client_message(data: &str) -> Result<ClientMessage, WireError> {
        serde_json::from_str(data).map_err(|e| WireError::Deserialization(e.to_string()))
    }

    pub fn encode_server_message(msg: &ServerMessage) -> Result<String, WireError> {
        serde_json::to_string(msg).map_err(|e| WireError::Serialization(e.to_string()))
    }

    pub fn decode_server_message(data: &str) -> Result<ServerMessage, WireError> {
        serde_json::from_str(data).map_err(|e| WireError::Deserialization(e.to_string()))
    }
}
