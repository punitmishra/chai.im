//! WebSocket message handling.

use crate::state::AppState;
use crate::ws::connection::OutgoingMessage;
use anyhow::Result;
use chai_common::UserId;
use chai_protocol::{ClientMessage, ServerMessage, MessageType};

/// Handle an incoming WebSocket message.
pub async fn handle_message(
    state: &AppState,
    sender_id: UserId,
    data: &[u8],
) -> Result<()> {
    // Try to parse as JSON first (for web clients)
    let message: ClientMessage = if let Ok(text) = std::str::from_utf8(data) {
        chai_protocol::json::decode_client_message(text)?
    } else {
        chai_protocol::decode_client_message(data)?
    };

    match message {
        ClientMessage::SendMessage {
            recipient_id,
            conversation_id,
            ciphertext,
            message_type,
        } => {
            handle_send_message(
                state,
                sender_id,
                recipient_id,
                conversation_id,
                ciphertext,
                message_type,
            ).await?;
        }

        ClientMessage::GetPrekeyBundle { user_id } => {
            handle_get_prekey_bundle(state, sender_id, user_id).await?;
        }

        ClientMessage::UploadPrekeyBundle { bundle } => {
            handle_upload_prekey_bundle(state, sender_id, bundle).await?;
        }

        ClientMessage::UploadOneTimePrekeys { prekeys } => {
            handle_upload_one_time_prekeys(state, sender_id, prekeys).await?;
        }

        ClientMessage::AckMessages { message_ids } => {
            handle_ack_messages(state, sender_id, message_ids).await?;
        }

        ClientMessage::Ping => {
            handle_ping(state, sender_id).await?;
        }

        ClientMessage::SubscribePresence { user_ids } => {
            handle_subscribe_presence(state, sender_id, user_ids).await?;
        }
    }

    Ok(())
}

async fn handle_send_message(
    state: &AppState,
    sender_id: UserId,
    recipient_id: UserId,
    conversation_id: chai_common::ConversationId,
    ciphertext: Vec<u8>,
    message_type: MessageType,
) -> Result<()> {
    let message_id = chai_common::MessageId::new();
    let timestamp = time::OffsetDateTime::now_utc().unix_timestamp();

    // Store message in database
    // TODO: Implement db::messages::store_message

    // Send to recipient if online
    let server_message = ServerMessage::Message {
        id: message_id,
        sender_id,
        conversation_id,
        ciphertext,
        message_type,
        timestamp,
    };

    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage { data: data.into_bytes() };

    let connections = state.connections.read().await;
    connections.send_to_user(&recipient_id, outgoing).await;

    // Send confirmation to sender
    let confirmation = ServerMessage::MessageSent { message_id };
    let data = chai_protocol::json::encode_server_message(&confirmation)?;
    let outgoing = OutgoingMessage { data: data.into_bytes() };
    connections.send_to_user(&sender_id, outgoing).await;

    Ok(())
}

async fn handle_get_prekey_bundle(
    state: &AppState,
    requester_id: UserId,
    user_id: UserId,
) -> Result<()> {
    // TODO: Fetch from database
    let bundle = None; // Placeholder

    let server_message = ServerMessage::PrekeyBundle { user_id, bundle };
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage { data: data.into_bytes() };

    let connections = state.connections.read().await;
    connections.send_to_user(&requester_id, outgoing).await;

    Ok(())
}

async fn handle_upload_prekey_bundle(
    state: &AppState,
    user_id: UserId,
    bundle: chai_protocol::PrekeyBundleData,
) -> Result<()> {
    // TODO: Store in database
    tracing::info!("User {:?} uploaded prekey bundle", user_id);
    Ok(())
}

async fn handle_upload_one_time_prekeys(
    state: &AppState,
    user_id: UserId,
    prekeys: Vec<chai_protocol::OneTimePrekey>,
) -> Result<()> {
    // TODO: Store in database
    tracing::info!("User {:?} uploaded {} one-time prekeys", user_id, prekeys.len());
    Ok(())
}

async fn handle_ack_messages(
    state: &AppState,
    user_id: UserId,
    message_ids: Vec<chai_common::MessageId>,
) -> Result<()> {
    // TODO: Mark messages as delivered in database
    tracing::debug!("User {:?} acked {} messages", user_id, message_ids.len());
    Ok(())
}

async fn handle_ping(state: &AppState, user_id: UserId) -> Result<()> {
    let server_message = ServerMessage::Pong;
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage { data: data.into_bytes() };

    let connections = state.connections.read().await;
    connections.send_to_user(&user_id, outgoing).await;

    Ok(())
}

async fn handle_subscribe_presence(
    state: &AppState,
    user_id: UserId,
    target_user_ids: Vec<UserId>,
) -> Result<()> {
    // Send current presence status for requested users
    let connections = state.connections.read().await;

    for target_id in target_user_ids {
        let online = connections.is_online(&target_id);
        let server_message = ServerMessage::PresenceUpdate {
            user_id: target_id,
            online,
        };
        let data = chai_protocol::json::encode_server_message(&server_message)?;
        let outgoing = OutgoingMessage { data: data.into_bytes() };
        connections.send_to_user(&user_id, outgoing).await;
    }

    Ok(())
}
