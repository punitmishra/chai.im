//! WebSocket message handling.

use crate::db::{messages, prekeys, users};
use crate::state::AppState;
use crate::ws::connection::OutgoingMessage;
use anyhow::Result;
use chai_common::UserId;
use chai_protocol::{ClientMessage, MessageType, PrekeyBundleData, ServerMessage};
use uuid::Uuid;

/// Handle an incoming WebSocket message.
pub async fn handle_message(state: &AppState, sender_id: UserId, data: &[u8]) -> Result<()> {
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
            )
            .await?;
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

        ClientMessage::TypingStart {
            recipient_id,
            conversation_id,
        } => {
            handle_typing_start(state, sender_id, recipient_id, conversation_id).await?;
        }

        ClientMessage::TypingStop {
            recipient_id,
            conversation_id,
        } => {
            handle_typing_stop(state, sender_id, recipient_id, conversation_id).await?;
        }

        ClientMessage::AddReaction {
            message_id,
            conversation_id,
            emoji,
        } => {
            handle_add_reaction(state, sender_id, message_id, conversation_id, emoji).await?;
        }

        ClientMessage::RemoveReaction {
            message_id,
            conversation_id,
            emoji,
        } => {
            handle_remove_reaction(state, sender_id, message_id, conversation_id, emoji).await?;
        }

        ClientMessage::MarkRead {
            conversation_id,
            message_ids,
        } => {
            handle_mark_read(state, sender_id, conversation_id, message_ids).await?;
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
    let timestamp = time::OffsetDateTime::now_utc().unix_timestamp();

    // Store message in database
    let stored_msg = messages::store_message(
        &state.db,
        Uuid::from(sender_id),
        Uuid::from(recipient_id),
        &ciphertext,
        message_type as i16,
    )
    .await?;

    let message_id = chai_common::MessageId::from(stored_msg.id);

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
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

    let connections = state.connections.read().await;
    connections.send_to_user(&recipient_id, outgoing).await;

    // Send confirmation to sender
    let confirmation = ServerMessage::MessageSent { message_id };
    let data = chai_protocol::json::encode_server_message(&confirmation)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };
    connections.send_to_user(&sender_id, outgoing).await;

    Ok(())
}

async fn handle_get_prekey_bundle(
    state: &AppState,
    requester_id: UserId,
    user_id: UserId,
) -> Result<()> {
    let target_uuid = Uuid::from(user_id);

    // Fetch user to get identity key
    let user = users::get_by_id(&state.db, target_uuid).await?;

    let bundle = match user {
        Some(u) => {
            // Fetch prekey bundle
            let pk = prekeys::get_prekey_bundle(&state.db, target_uuid).await?;

            match pk {
                Some(prekey) => {
                    // Try to consume a one-time prekey
                    let otp = prekeys::consume_one_time_prekey(&state.db, target_uuid).await?;

                    // Check if one-time prekeys are running low
                    let remaining = prekeys::count_one_time_prekeys(&state.db, target_uuid).await?;
                    if remaining < 10 {
                        // Notify user to upload more prekeys
                        let warning = ServerMessage::LowPrekeys {
                            remaining: remaining as u32,
                        };
                        let data = chai_protocol::json::encode_server_message(&warning)?;
                        let outgoing = OutgoingMessage {
                            data: data.into_bytes(),
                        };
                        let connections = state.connections.read().await;
                        connections.send_to_user(&user_id, outgoing).await;
                    }

                    Some(PrekeyBundleData {
                        identity_key: u.identity_key,
                        signed_prekey: prekey.signed_prekey,
                        signed_prekey_signature: prekey.signed_prekey_signature,
                        signed_prekey_id: prekey.prekey_id as u32,
                        one_time_prekey: otp.as_ref().map(|o| o.prekey.clone()),
                        one_time_prekey_id: otp.as_ref().map(|o| o.prekey_id as u32),
                    })
                }
                None => None,
            }
        }
        None => None,
    };

    let server_message = ServerMessage::PrekeyBundle { user_id, bundle };
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

    let connections = state.connections.read().await;
    connections.send_to_user(&requester_id, outgoing).await;

    Ok(())
}

async fn handle_upload_prekey_bundle(
    state: &AppState,
    user_id: UserId,
    bundle: PrekeyBundleData,
) -> Result<()> {
    prekeys::store_prekey_bundle(
        &state.db,
        Uuid::from(user_id),
        &bundle.signed_prekey,
        &bundle.signed_prekey_signature,
        bundle.signed_prekey_id as i32,
    )
    .await?;

    tracing::info!("User {:?} uploaded prekey bundle", user_id);
    Ok(())
}

async fn handle_upload_one_time_prekeys(
    state: &AppState,
    user_id: UserId,
    prekeys_list: Vec<chai_protocol::OneTimePrekey>,
) -> Result<()> {
    let prekey_data: Vec<(i32, Vec<u8>)> = prekeys_list
        .iter()
        .map(|p| (p.id as i32, p.key.clone()))
        .collect();

    let count =
        prekeys::store_one_time_prekeys(&state.db, Uuid::from(user_id), &prekey_data).await?;

    tracing::info!(
        "User {:?} uploaded {} one-time prekeys",
        user_id,
        count
    );
    Ok(())
}

async fn handle_ack_messages(
    state: &AppState,
    user_id: UserId,
    message_ids: Vec<chai_common::MessageId>,
) -> Result<()> {
    let uuids: Vec<Uuid> = message_ids.iter().map(|id| id.0).collect();

    let count = messages::mark_delivered(&state.db, &uuids).await?;

    tracing::debug!(
        "User {:?} acked {} messages ({} marked delivered)",
        user_id,
        message_ids.len(),
        count
    );
    Ok(())
}

async fn handle_ping(state: &AppState, user_id: UserId) -> Result<()> {
    let server_message = ServerMessage::Pong;
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

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
        let outgoing = OutgoingMessage {
            data: data.into_bytes(),
        };
        connections.send_to_user(&user_id, outgoing).await;
    }

    Ok(())
}

async fn handle_typing_start(
    state: &AppState,
    sender_id: UserId,
    recipient_id: UserId,
    conversation_id: chai_common::ConversationId,
) -> Result<()> {
    let server_message = ServerMessage::TypingIndicator {
        user_id: sender_id,
        conversation_id,
        is_typing: true,
    };
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

    let connections = state.connections.read().await;
    connections.send_to_user(&recipient_id, outgoing).await;

    tracing::debug!("User {:?} started typing to {:?}", sender_id, recipient_id);
    Ok(())
}

async fn handle_typing_stop(
    state: &AppState,
    sender_id: UserId,
    recipient_id: UserId,
    conversation_id: chai_common::ConversationId,
) -> Result<()> {
    let server_message = ServerMessage::TypingIndicator {
        user_id: sender_id,
        conversation_id,
        is_typing: false,
    };
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

    let connections = state.connections.read().await;
    connections.send_to_user(&recipient_id, outgoing).await;

    tracing::debug!("User {:?} stopped typing to {:?}", sender_id, recipient_id);
    Ok(())
}

async fn handle_add_reaction(
    state: &AppState,
    sender_id: UserId,
    message_id: chai_common::MessageId,
    conversation_id: chai_common::ConversationId,
    emoji: String,
) -> Result<()> {
    // For now, just forward the reaction to all participants in the conversation
    // In a 1:1 chat, the conversation_id contains both user IDs
    // We'll extract the recipient from the conversation_id
    let recipient_id = extract_recipient_from_conversation(sender_id, conversation_id);

    let server_message = ServerMessage::ReactionAdded {
        message_id,
        conversation_id,
        user_id: sender_id,
        emoji: emoji.clone(),
    };
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

    let connections = state.connections.read().await;
    // Send to recipient
    connections.send_to_user(&recipient_id, outgoing.clone()).await;
    // Also send back to sender for confirmation
    connections.send_to_user(&sender_id, outgoing).await;

    tracing::debug!(
        "User {:?} added reaction {} to message {:?}",
        sender_id,
        emoji,
        message_id
    );
    Ok(())
}

async fn handle_remove_reaction(
    state: &AppState,
    sender_id: UserId,
    message_id: chai_common::MessageId,
    conversation_id: chai_common::ConversationId,
    emoji: String,
) -> Result<()> {
    let recipient_id = extract_recipient_from_conversation(sender_id, conversation_id);

    let server_message = ServerMessage::ReactionRemoved {
        message_id,
        conversation_id,
        user_id: sender_id,
        emoji: emoji.clone(),
    };
    let data = chai_protocol::json::encode_server_message(&server_message)?;
    let outgoing = OutgoingMessage {
        data: data.into_bytes(),
    };

    let connections = state.connections.read().await;
    connections.send_to_user(&recipient_id, outgoing.clone()).await;
    connections.send_to_user(&sender_id, outgoing).await;

    tracing::debug!(
        "User {:?} removed reaction {} from message {:?}",
        sender_id,
        emoji,
        message_id
    );
    Ok(())
}

async fn handle_mark_read(
    state: &AppState,
    sender_id: UserId,
    conversation_id: chai_common::ConversationId,
    message_ids: Vec<chai_common::MessageId>,
) -> Result<()> {
    let recipient_id = extract_recipient_from_conversation(sender_id, conversation_id);

    // Send read receipts for each message
    let connections = state.connections.read().await;
    for message_id in &message_ids {
        let server_message = ServerMessage::MessageRead {
            message_id: *message_id,
        };
        let data = chai_protocol::json::encode_server_message(&server_message)?;
        let outgoing = OutgoingMessage {
            data: data.into_bytes(),
        };
        connections.send_to_user(&recipient_id, outgoing).await;
    }

    tracing::debug!(
        "User {:?} marked {} messages as read",
        sender_id,
        message_ids.len()
    );
    Ok(())
}

/// Extract the recipient user ID from a conversation ID.
/// For 1:1 chats, conversation IDs are typically constructed from both user IDs.
fn extract_recipient_from_conversation(
    _sender_id: UserId,
    conversation_id: chai_common::ConversationId,
) -> UserId {
    // The conversation ID is a UUID that may be derived from both user IDs
    // For simplicity, we'll use a convention where the conversation includes both users
    // In a real implementation, we'd look up conversation participants from DB
    // For now, return the conversation_id as a user_id (works for simple cases)
    UserId::from(conversation_id.0)
}
