//! WebSocket upgrade handler.

use crate::db::sessions;
use crate::state::AppState;
use crate::ws::connection::OutgoingMessage;
use crate::ws::message::handle_message;
use crate::ws::presence::broadcast_presence_update;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
};
use chai_common::UserId;
use chai_protocol::UserStatus;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

/// WebSocket upgrade handler.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    // Authenticate the connection
    let user_id = match authenticate(&state, query.token).await {
        Ok(id) => id,
        Err(_) => {
            return (StatusCode::UNAUTHORIZED, "Invalid or missing token").into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, user_id))
}

/// Authenticate WebSocket connection using session token.
async fn authenticate(state: &AppState, token: Option<String>) -> Result<UserId, ()> {
    let token = token.ok_or(())?;

    // Hash the token
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hasher.finalize().to_vec();

    // Look up session
    let session = sessions::get_by_token_hash(&state.db, &token_hash)
        .await
        .map_err(|_| ())?
        .ok_or(())?;

    Ok(UserId::from(session.user_id))
}

/// Handle a WebSocket connection.
async fn handle_socket(socket: WebSocket, state: Arc<AppState>, user_id: UserId) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::channel::<OutgoingMessage>(100);

    // Register connection (lock-free via DashMap)
    // The connection manager tracks device connections and returns a handle
    let device_conn = state.connections.add(user_id, tx.clone());

    // Broadcast that user is now online
    broadcast_presence_update(&state, user_id, UserStatus::Active, None).await;

    tracing::info!("New WebSocket connection: {:?}", user_id);

    // Spawn task to forward outgoing messages
    // Uses Bytes for zero-copy message passing
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            // Convert Bytes to Vec<u8> for axum's Message::Binary
            if sender
                .send(Message::Binary(msg.data.to_vec()))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = receiver.next().await {
        // Record message received for metrics
        device_conn.record_message_received();

        match msg {
            Ok(Message::Binary(data)) => {
                if let Err(e) = handle_message(&state, user_id, &data).await {
                    tracing::error!("Error handling message: {}", e);
                }
            }
            Ok(Message::Text(text)) => {
                // Handle JSON messages from web clients
                if let Err(e) = handle_message(&state, user_id, text.as_bytes()).await {
                    tracing::error!("Error handling message: {}", e);
                }
            }
            Ok(Message::Ping(_)) => {
                // Pong is handled automatically by axum
                // Touch activity to prevent auto-away
                state.connections.touch_activity(&user_id);
                tracing::trace!("Received ping");
            }
            Ok(Message::Pong(_)) => {
                tracing::trace!("Received pong");
            }
            Ok(Message::Close(_)) => {
                tracing::info!("Client closed connection: {:?}", user_id);
                break;
            }
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
        }
    }

    // Get last active timestamp before cleanup (lock-free)
    let last_active = state.connections.get_last_active(&user_id);

    // Cleanup connection (lock-free via DashMap)
    // Returns true if this was the user's last connection
    let was_last = state.connections.remove(&user_id, &tx);

    // Broadcast offline status only if this was the user's last connection
    if was_last {
        broadcast_presence_update(&state, user_id, UserStatus::Offline, last_active).await;
    }

    send_task.abort();
    tracing::info!("Connection closed: {:?}", user_id);
}
