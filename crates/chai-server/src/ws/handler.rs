//! WebSocket upgrade handler.

use crate::state::AppState;
use crate::ws::connection::OutgoingMessage;
use crate::ws::message::handle_message;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use chai_common::UserId;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;

/// WebSocket upgrade handler.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Handle a WebSocket connection.
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::channel::<OutgoingMessage>(100);

    // TODO: Authenticate the connection first
    // For now, generate a temporary user ID
    let user_id = UserId::new();

    // Register connection
    {
        let mut connections = state.connections.write().await;
        connections.add(user_id, tx.clone());
    }

    tracing::info!("New WebSocket connection: {:?}", user_id);

    // Spawn task to forward outgoing messages
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Binary(msg.data)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = receiver.next().await {
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
            Ok(Message::Ping(data)) => {
                // Pong is handled automatically by axum
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

    // Cleanup
    {
        let mut connections = state.connections.write().await;
        connections.remove(&user_id, &tx);
    }

    send_task.abort();
    tracing::info!("Connection closed: {:?}", user_id);
}
