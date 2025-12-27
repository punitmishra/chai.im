//! Message type definitions.

use chai_common::{ConversationId, MessageId, UserId};
use serde::{Deserialize, Serialize};

/// Client-to-server message types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMessage {
    /// Send an encrypted message to a recipient.
    SendMessage {
        recipient_id: UserId,
        conversation_id: ConversationId,
        ciphertext: Vec<u8>,
        message_type: MessageType,
    },

    /// Request a user's prekey bundle for session initialization.
    GetPrekeyBundle { user_id: UserId },

    /// Upload prekey bundle.
    UploadPrekeyBundle { bundle: PrekeyBundleData },

    /// Upload one-time prekeys.
    UploadOneTimePrekeys { prekeys: Vec<OneTimePrekey> },

    /// Mark messages as delivered.
    AckMessages { message_ids: Vec<MessageId> },

    /// Ping to keep connection alive.
    Ping,

    /// Subscribe to presence updates.
    SubscribePresence { user_ids: Vec<UserId> },

    /// Typing indicator start.
    TypingStart {
        recipient_id: UserId,
        conversation_id: ConversationId,
    },

    /// Typing indicator stop.
    TypingStop {
        recipient_id: UserId,
        conversation_id: ConversationId,
    },

    /// Add a reaction to a message.
    AddReaction {
        message_id: MessageId,
        conversation_id: ConversationId,
        emoji: String,
    },

    /// Remove a reaction from a message.
    RemoveReaction {
        message_id: MessageId,
        conversation_id: ConversationId,
        emoji: String,
    },

    /// Mark messages as read.
    MarkRead {
        conversation_id: ConversationId,
        message_ids: Vec<MessageId>,
    },
}

/// Server-to-client message types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMessage {
    /// Incoming encrypted message.
    Message {
        id: MessageId,
        sender_id: UserId,
        conversation_id: ConversationId,
        ciphertext: Vec<u8>,
        message_type: MessageType,
        timestamp: i64,
    },

    /// Prekey bundle response.
    PrekeyBundle {
        user_id: UserId,
        bundle: Option<PrekeyBundleData>,
    },

    /// Message delivery confirmation.
    MessageSent { message_id: MessageId },

    /// Message delivery receipt.
    MessageDelivered { message_id: MessageId },

    /// Message read receipt.
    MessageRead { message_id: MessageId },

    /// Pong response.
    Pong,

    /// User presence update.
    PresenceUpdate { user_id: UserId, online: bool },

    /// Typing indicator from another user.
    TypingIndicator {
        user_id: UserId,
        conversation_id: ConversationId,
        is_typing: bool,
    },

    /// Reaction added to a message.
    ReactionAdded {
        message_id: MessageId,
        conversation_id: ConversationId,
        user_id: UserId,
        emoji: String,
    },

    /// Reaction removed from a message.
    ReactionRemoved {
        message_id: MessageId,
        conversation_id: ConversationId,
        user_id: UserId,
        emoji: String,
    },

    /// Error response.
    Error { code: ErrorCode, message: String },

    /// Low prekey warning.
    LowPrekeys { remaining: u32 },
}

/// Message content type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageType {
    /// Initial prekey message (X3DH).
    Prekey = 1,
    /// Normal encrypted message.
    Normal = 2,
    /// Delivery receipt.
    Receipt = 3,
    /// Key update notification.
    KeyUpdate = 4,
}

/// Prekey bundle data for X3DH.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrekeyBundleData {
    /// User's public identity key (Ed25519).
    pub identity_key: Vec<u8>,
    /// Signed prekey (X25519).
    pub signed_prekey: Vec<u8>,
    /// Signature over signed prekey.
    pub signed_prekey_signature: Vec<u8>,
    /// Signed prekey ID.
    pub signed_prekey_id: u32,
    /// Optional one-time prekey (X25519).
    pub one_time_prekey: Option<Vec<u8>>,
    /// One-time prekey ID (if present).
    pub one_time_prekey_id: Option<u32>,
}

/// One-time prekey for upload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneTimePrekey {
    pub id: u32,
    pub key: Vec<u8>,
}

/// Error codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u16)]
pub enum ErrorCode {
    InvalidMessage = 1000,
    Unauthorized = 1001,
    UserNotFound = 1002,
    SessionExpired = 1003,
    RateLimited = 1004,
    InternalError = 5000,
}
