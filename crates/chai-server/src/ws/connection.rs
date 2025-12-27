//! WebSocket connection management.

use chai_common::UserId;
use std::collections::HashMap;
use tokio::sync::mpsc;

/// Message to send to a connected client.
#[derive(Debug, Clone)]
pub struct OutgoingMessage {
    pub data: Vec<u8>,
}

/// A connected client.
pub struct Connection {
    pub user_id: UserId,
    pub sender: mpsc::Sender<OutgoingMessage>,
}

/// Manages all active WebSocket connections.
pub struct ConnectionManager {
    /// Map of user ID to their connections.
    connections: HashMap<UserId, Vec<Connection>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    /// Register a new connection.
    pub fn add(&mut self, user_id: UserId, sender: mpsc::Sender<OutgoingMessage>) {
        let conn = Connection { user_id, sender };
        self.connections.entry(user_id).or_default().push(conn);
    }

    /// Remove a connection.
    pub fn remove(&mut self, user_id: &UserId, sender: &mpsc::Sender<OutgoingMessage>) {
        if let Some(conns) = self.connections.get_mut(user_id) {
            conns.retain(|c| !c.sender.same_channel(sender));
            if conns.is_empty() {
                self.connections.remove(user_id);
            }
        }
    }

    /// Check if a user is online.
    pub fn is_online(&self, user_id: &UserId) -> bool {
        self.connections.contains_key(user_id)
    }

    /// Send a message to a user (all their connections).
    pub async fn send_to_user(&self, user_id: &UserId, message: OutgoingMessage) {
        if let Some(conns) = self.connections.get(user_id) {
            for conn in conns {
                let _ = conn.sender.send(message.clone()).await;
            }
        }
    }

    /// Get all online user IDs.
    pub fn online_users(&self) -> Vec<UserId> {
        self.connections.keys().copied().collect()
    }

    /// Get connection count for a user.
    pub fn connection_count(&self, user_id: &UserId) -> usize {
        self.connections.get(user_id).map(|c| c.len()).unwrap_or(0)
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}
