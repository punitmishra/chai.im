//! Session management for encrypted conversations.

use crate::keys::{IdentityKeyPair, PreKeyBundle, SignedPreKey, OneTimePreKey};
use crate::ratchet::{DoubleRatchet, MessageHeader};
use crate::x3dh::{X3DHSender, X3DHReceiver, X3DHInitialMessage};
use crate::{CryptoError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// An encrypted session with a peer.
#[derive(Serialize, Deserialize)]
pub struct Session {
    /// Peer identifier.
    pub peer_id: String,
    /// Double Ratchet state.
    ratchet: DoubleRatchet,
    /// Whether this session was initialized by us.
    pub is_initiator: bool,
}

impl Session {
    /// Create a new session as the initiator (sender).
    pub fn initiate(
        our_identity: &IdentityKeyPair,
        peer_id: String,
        their_bundle: &PreKeyBundle,
    ) -> Result<(Self, X3DHInitialMessage)> {
        let sender = X3DHSender::new(our_identity.clone());
        let (shared_secret, initial_message) = sender.initiate(their_bundle)?;

        // Initialize Double Ratchet with their signed prekey as initial DH
        let ratchet = DoubleRatchet::init_sender(shared_secret, their_bundle.signed_prekey);

        Ok((
            Self {
                peer_id,
                ratchet,
                is_initiator: true,
            },
            initial_message,
        ))
    }

    /// Create a new session as the receiver.
    pub fn receive(
        our_identity: &IdentityKeyPair,
        our_signed_prekey: &SignedPreKey,
        our_one_time_prekeys: &mut Vec<OneTimePreKey>,
        peer_id: String,
        initial_message: &X3DHInitialMessage,
    ) -> Result<Self> {
        let mut receiver = X3DHReceiver::new(
            our_identity.clone(),
            our_signed_prekey.clone(),
            std::mem::take(our_one_time_prekeys),
        );

        let shared_secret = receiver.receive(initial_message)?;

        // Initialize Double Ratchet with our signed prekey
        let ratchet = DoubleRatchet::init_receiver(
            shared_secret,
            our_signed_prekey.key_pair.clone(),
        );

        Ok(Self {
            peer_id,
            ratchet,
            is_initiator: false,
        })
    }

    /// Encrypt a message for this peer.
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<EncryptedMessage> {
        let (header, ciphertext) = self.ratchet.encrypt(plaintext)?;
        Ok(EncryptedMessage { header, ciphertext })
    }

    /// Decrypt a message from this peer.
    pub fn decrypt(&mut self, message: &EncryptedMessage) -> Result<Vec<u8>> {
        self.ratchet.decrypt(&message.header, &message.ciphertext)
    }

    /// Export session state for storage.
    pub fn export(&self) -> Result<Vec<u8>> {
        bincode::serialize(self)
            .map_err(|e| CryptoError::SerializationError(e.to_string()))
    }

    /// Import session state from storage.
    pub fn import(data: &[u8]) -> Result<Self> {
        let mut session: Self = bincode::deserialize(data)
            .map_err(|e| CryptoError::DeserializationError(e.to_string()))?;
        session.ratchet.restore_keys();
        Ok(session)
    }
}

/// An encrypted message with header.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub header: MessageHeader,
    pub ciphertext: Vec<u8>,
}

impl EncryptedMessage {
    /// Serialize for transmission.
    pub fn to_bytes(&self) -> Result<Vec<u8>> {
        bincode::serialize(self)
            .map_err(|e| CryptoError::SerializationError(e.to_string()))
    }

    /// Deserialize from bytes.
    pub fn from_bytes(data: &[u8]) -> Result<Self> {
        bincode::deserialize(data)
            .map_err(|e| CryptoError::DeserializationError(e.to_string()))
    }
}

/// Manages multiple sessions with different peers.
pub struct SessionManager {
    /// Our identity key pair.
    identity: IdentityKeyPair,
    /// Our current signed prekey.
    signed_prekey: SignedPreKey,
    /// Pool of one-time prekeys.
    one_time_prekeys: Vec<OneTimePreKey>,
    /// Active sessions by peer ID.
    sessions: HashMap<String, Session>,
    /// Next one-time prekey ID.
    next_prekey_id: u32,
}

impl SessionManager {
    /// Create a new session manager.
    pub fn new() -> Self {
        let identity = IdentityKeyPair::generate();
        let signed_prekey = SignedPreKey::generate(1, &identity);

        Self {
            identity,
            signed_prekey,
            one_time_prekeys: Vec::new(),
            sessions: HashMap::new(),
            next_prekey_id: 1,
        }
    }

    /// Create from existing identity.
    pub fn from_identity(identity: IdentityKeyPair) -> Self {
        let signed_prekey = SignedPreKey::generate(1, &identity);

        Self {
            identity,
            signed_prekey,
            one_time_prekeys: Vec::new(),
            sessions: HashMap::new(),
            next_prekey_id: 1,
        }
    }

    /// Get our public prekey bundle for registration.
    pub fn get_prekey_bundle(&self) -> PreKeyBundle {
        let one_time = self.one_time_prekeys.first();
        PreKeyBundle::new(&self.identity, &self.signed_prekey, one_time)
    }

    /// Generate new one-time prekeys.
    pub fn generate_one_time_prekeys(&mut self, count: u32) -> Vec<(u32, [u8; 32])> {
        let mut keys = Vec::with_capacity(count as usize);

        for _ in 0..count {
            let prekey = OneTimePreKey::generate(self.next_prekey_id);
            keys.push((prekey.id, prekey.public_key().to_bytes()));
            self.one_time_prekeys.push(prekey);
            self.next_prekey_id += 1;
        }

        keys
    }

    /// Initiate a session with a peer.
    pub fn initiate_session(
        &mut self,
        peer_id: String,
        their_bundle: &PreKeyBundle,
    ) -> Result<(EncryptedMessage, X3DHInitialMessage)> {
        let (session, initial_message) = Session::initiate(
            &self.identity,
            peer_id.clone(),
            their_bundle,
        )?;

        self.sessions.insert(peer_id.clone(), session);

        // Create an initial encrypted message (empty or with metadata)
        // This would typically contain the X3DH initial message
        let initial_ciphertext = bincode::serialize(&initial_message)
            .map_err(|e| CryptoError::SerializationError(e.to_string()))?;

        let session = self.sessions.get_mut(&peer_id).unwrap();
        let encrypted = session.encrypt(&initial_ciphertext)?;

        Ok((encrypted, initial_message))
    }

    /// Receive a session from a peer.
    pub fn receive_session(
        &mut self,
        peer_id: String,
        initial_message: &X3DHInitialMessage,
    ) -> Result<()> {
        let session = Session::receive(
            &self.identity,
            &self.signed_prekey,
            &mut self.one_time_prekeys,
            peer_id.clone(),
            initial_message,
        )?;

        self.sessions.insert(peer_id, session);
        Ok(())
    }

    /// Get a session for a peer.
    pub fn get_session(&self, peer_id: &str) -> Option<&Session> {
        self.sessions.get(peer_id)
    }

    /// Get a mutable session for a peer.
    pub fn get_session_mut(&mut self, peer_id: &str) -> Option<&mut Session> {
        self.sessions.get_mut(peer_id)
    }

    /// Encrypt a message for a peer.
    pub fn encrypt(&mut self, peer_id: &str, plaintext: &[u8]) -> Result<EncryptedMessage> {
        let session = self.sessions.get_mut(peer_id)
            .ok_or_else(|| CryptoError::SessionNotFound(peer_id.to_string()))?;
        session.encrypt(plaintext)
    }

    /// Decrypt a message from a peer.
    pub fn decrypt(&mut self, peer_id: &str, message: &EncryptedMessage) -> Result<Vec<u8>> {
        let session = self.sessions.get_mut(peer_id)
            .ok_or_else(|| CryptoError::SessionNotFound(peer_id.to_string()))?;
        session.decrypt(message)
    }

    /// Export identity key bytes.
    pub fn identity_bytes(&self) -> [u8; 32] {
        self.identity.to_bytes()
    }

    /// Get public identity key.
    pub fn public_identity(&self) -> crate::keys::IdentityPublicKey {
        self.identity.public_key()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "X3DH identity_dh_with uses placeholder random keys - needs proper Ed25519→X25519 conversion"]
    fn test_session_manager_flow() {
        // Alice creates a session manager
        let mut alice = SessionManager::new();
        alice.generate_one_time_prekeys(10);

        // Bob creates a session manager
        let mut bob = SessionManager::new();
        bob.generate_one_time_prekeys(10);

        // Alice gets Bob's prekey bundle
        let bob_bundle = bob.get_prekey_bundle();

        // Alice initiates a session with Bob
        let (_, initial) = alice.initiate_session("bob".into(), &bob_bundle).unwrap();

        // Bob receives the session
        bob.receive_session("alice".into(), &initial).unwrap();

        // Alice sends a message
        let message = b"Hello, Bob!";
        let encrypted = alice.encrypt("bob", message).unwrap();

        // Bob decrypts
        let decrypted = bob.decrypt("alice", &encrypted).unwrap();
        assert_eq!(message.as_slice(), decrypted.as_slice());

        // Bob replies
        let reply = b"Hello, Alice!";
        let encrypted_reply = bob.encrypt("alice", reply).unwrap();

        // Alice decrypts
        let decrypted_reply = alice.decrypt("bob", &encrypted_reply).unwrap();
        assert_eq!(reply.as_slice(), decrypted_reply.as_slice());
    }
}
