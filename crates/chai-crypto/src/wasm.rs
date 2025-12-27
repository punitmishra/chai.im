//! WASM bindings for chai-crypto.
//!
//! This module provides JavaScript bindings for the Signal Protocol implementation.

use crate::keys::{IdentityKeyPair, IdentityPublicKey, PreKeyBundle};
use crate::session::{EncryptedMessage, SessionManager};
use crate::x3dh::X3DHInitialMessage;
use wasm_bindgen::prelude::*;

/// Initialize console logging for WASM debugging.
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Crypto manager for handling E2E encryption from JavaScript.
#[wasm_bindgen]
pub struct CryptoManager {
    inner: SessionManager,
}

#[wasm_bindgen]
impl CryptoManager {
    /// Create a new crypto manager with a fresh identity.
    #[wasm_bindgen(constructor)]
    pub fn new() -> CryptoManager {
        CryptoManager {
            inner: SessionManager::new(),
        }
    }

    /// Restore from exported identity bytes.
    #[wasm_bindgen(js_name = fromBytes)]
    pub fn from_bytes(data: &[u8]) -> Result<CryptoManager, JsValue> {
        if data.len() < 32 {
            return Err(JsValue::from_str("Invalid identity data length"));
        }

        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&data[0..32]);
        let identity = IdentityKeyPair::from_bytes(&bytes);

        Ok(CryptoManager {
            inner: SessionManager::from_identity(identity),
        })
    }

    /// Export the identity key bytes for storage.
    #[wasm_bindgen(js_name = exportIdentity)]
    pub fn export_identity(&self) -> Vec<u8> {
        self.inner.identity_bytes().to_vec()
    }

    /// Get the public identity key.
    #[wasm_bindgen(js_name = publicIdentity)]
    pub fn public_identity(&self) -> Vec<u8> {
        self.inner.public_identity().to_bytes().to_vec()
    }

    /// Generate a prekey bundle for registration.
    /// Returns serialized bundle data.
    #[wasm_bindgen(js_name = generatePrekeyBundle)]
    pub fn generate_prekey_bundle(&mut self) -> Vec<u8> {
        // Generate some one-time prekeys first
        self.inner.generate_one_time_prekeys(10);

        let bundle = self.inner.get_prekey_bundle();

        // Serialize bundle to a simple format:
        // [identity_key(32)] [signed_prekey(32)] [signature(64)] [signed_prekey_id(4)]
        // [has_otp(1)] [otp(32)?] [otp_id(4)?]
        let mut data = Vec::with_capacity(200);

        // Identity key
        data.extend_from_slice(&bundle.identity_key.to_bytes());

        // Signed prekey
        data.extend_from_slice(&bundle.signed_prekey);

        // Signature
        data.extend_from_slice(&bundle.signed_prekey_signature);

        // Signed prekey ID (little endian)
        data.extend_from_slice(&bundle.signed_prekey_id.to_le_bytes());

        // One-time prekey (optional)
        if let Some(otp) = &bundle.one_time_prekey {
            data.push(1); // has OTP
            data.extend_from_slice(otp);
            data.extend_from_slice(&bundle.one_time_prekey_id.unwrap().to_le_bytes());
        } else {
            data.push(0); // no OTP
        }

        data
    }

    /// Generate additional one-time prekeys.
    /// Returns array of (id, public_key) pairs as bytes.
    #[wasm_bindgen(js_name = generateOneTimePrekeys)]
    pub fn generate_one_time_prekeys(&mut self, count: u32) -> Vec<u8> {
        let keys = self.inner.generate_one_time_prekeys(count);

        // Serialize as [count(4)] then [id(4)][key(32)]...
        let mut data = Vec::with_capacity(4 + keys.len() * 36);
        data.extend_from_slice(&(keys.len() as u32).to_le_bytes());

        for (id, key) in keys {
            data.extend_from_slice(&id.to_le_bytes());
            data.extend_from_slice(&key);
        }

        data
    }

    /// Initialize a session with a peer using their prekey bundle.
    /// bundle_data format: same as generatePrekeyBundle output
    #[wasm_bindgen(js_name = initSession)]
    pub fn init_session(&mut self, peer_id: &str, bundle_data: &[u8]) -> Result<Vec<u8>, JsValue> {
        let bundle = parse_prekey_bundle(bundle_data).map_err(|e| JsValue::from_str(&e))?;

        let (encrypted, initial) = self
            .inner
            .initiate_session(peer_id.to_string(), &bundle)
            .map_err(|e| JsValue::from_str(&format!("Session init failed: {}", e)))?;

        // Return the initial message as bytes
        let mut data = Vec::new();

        // Serialize X3DH initial message
        data.extend_from_slice(&initial.identity_key);
        data.extend_from_slice(&initial.ephemeral_key);
        data.extend_from_slice(&initial.signed_prekey_id.to_le_bytes());

        if let Some(otp_id) = initial.one_time_prekey_id {
            data.push(1);
            data.extend_from_slice(&otp_id.to_le_bytes());
        } else {
            data.push(0);
        }

        // Serialize encrypted message
        let enc_bytes = encrypted
            .to_bytes()
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))?;
        data.extend_from_slice(&(enc_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(&enc_bytes);

        Ok(data)
    }

    /// Receive a session from a peer's initial message.
    #[wasm_bindgen(js_name = receiveSession)]
    pub fn receive_session(&mut self, peer_id: &str, initial_data: &[u8]) -> Result<(), JsValue> {
        let initial = parse_initial_message(initial_data).map_err(|e| JsValue::from_str(&e))?;

        self.inner
            .receive_session(peer_id.to_string(), &initial)
            .map_err(|e| JsValue::from_str(&format!("Receive session failed: {}", e)))
    }

    /// Encrypt a message for a peer.
    #[wasm_bindgen]
    pub fn encrypt(&mut self, peer_id: &str, plaintext: &[u8]) -> Result<Vec<u8>, JsValue> {
        let encrypted = self
            .inner
            .encrypt(peer_id, plaintext)
            .map_err(|e| JsValue::from_str(&format!("Encryption failed: {}", e)))?;

        encrypted
            .to_bytes()
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Decrypt a message from a peer.
    #[wasm_bindgen]
    pub fn decrypt(&mut self, peer_id: &str, ciphertext: &[u8]) -> Result<Vec<u8>, JsValue> {
        let message = EncryptedMessage::from_bytes(ciphertext)
            .map_err(|e| JsValue::from_str(&format!("Deserialization failed: {}", e)))?;

        self.inner
            .decrypt(peer_id, &message)
            .map_err(|e| JsValue::from_str(&format!("Decryption failed: {}", e)))
    }

    /// Check if a session exists with a peer.
    #[wasm_bindgen(js_name = hasSession)]
    pub fn has_session(&self, peer_id: &str) -> bool {
        self.inner.get_session(peer_id).is_some()
    }

    /// Export a session for storage.
    #[wasm_bindgen(js_name = exportSession)]
    pub fn export_session(&self, peer_id: &str) -> Result<Vec<u8>, JsValue> {
        let session = self
            .inner
            .get_session(peer_id)
            .ok_or_else(|| JsValue::from_str("Session not found"))?;

        session
            .export()
            .map_err(|e| JsValue::from_str(&format!("Export failed: {}", e)))
    }

    /// Import a session from storage.
    #[wasm_bindgen(js_name = importSession)]
    pub fn import_session(&mut self, peer_id: &str, data: &[u8]) -> Result<(), JsValue> {
        use crate::session::Session;

        let session = Session::import(data)
            .map_err(|e| JsValue::from_str(&format!("Import failed: {}", e)))?;

        // Use internal method - need to add this to SessionManager
        // For now, this is a placeholder
        Err(JsValue::from_str("Session import not yet implemented"))
    }
}

impl Default for CryptoManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse a prekey bundle from bytes.
fn parse_prekey_bundle(data: &[u8]) -> Result<PreKeyBundle, String> {
    if data.len() < 101 {
        // 32 + 32 + 64 + 4 + 1 = 133 minimum without variable signature
        return Err("Bundle data too short".into());
    }

    let mut offset = 0;

    // Identity key (32 bytes)
    let mut identity_bytes = [0u8; 32];
    identity_bytes.copy_from_slice(&data[offset..offset + 32]);
    offset += 32;

    let identity_key = IdentityPublicKey::from_bytes(&identity_bytes)
        .map_err(|e| format!("Invalid identity key: {}", e))?;

    // Signed prekey (32 bytes)
    let mut signed_prekey = [0u8; 32];
    signed_prekey.copy_from_slice(&data[offset..offset + 32]);
    offset += 32;

    // Signature (64 bytes)
    let signature = data[offset..offset + 64].to_vec();
    offset += 64;

    // Signed prekey ID (4 bytes)
    let signed_prekey_id = u32::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]);
    offset += 4;

    // One-time prekey (optional)
    let (one_time_prekey, one_time_prekey_id) = if data[offset] == 1 {
        offset += 1;
        let mut otp = [0u8; 32];
        otp.copy_from_slice(&data[offset..offset + 32]);
        offset += 32;
        let otp_id = u32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ]);
        (Some(otp), Some(otp_id))
    } else {
        (None, None)
    };

    Ok(PreKeyBundle {
        identity_key,
        signed_prekey,
        signed_prekey_id,
        signed_prekey_signature: signature,
        one_time_prekey,
        one_time_prekey_id,
    })
}

/// Parse an X3DH initial message from bytes.
fn parse_initial_message(data: &[u8]) -> Result<X3DHInitialMessage, String> {
    if data.len() < 69 {
        // 32 + 32 + 4 + 1 = 69 minimum
        return Err("Initial message too short".into());
    }

    let mut offset = 0;

    // Identity key (32 bytes)
    let mut identity_key = [0u8; 32];
    identity_key.copy_from_slice(&data[offset..offset + 32]);
    offset += 32;

    // Ephemeral key (32 bytes)
    let mut ephemeral_key = [0u8; 32];
    ephemeral_key.copy_from_slice(&data[offset..offset + 32]);
    offset += 32;

    // Signed prekey ID (4 bytes)
    let signed_prekey_id = u32::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]);
    offset += 4;

    // One-time prekey ID (optional)
    let one_time_prekey_id = if data[offset] == 1 {
        offset += 1;
        Some(u32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ]))
    } else {
        None
    };

    Ok(X3DHInitialMessage {
        identity_key,
        ephemeral_key,
        signed_prekey_id,
        one_time_prekey_id,
    })
}
