//! Presence broadcasting utilities.

use crate::state::AppState;
use crate::ws::connection::OutgoingMessage;
use chai_common::UserId;
use chai_protocol::{ServerMessage, UserStatus};

/// Broadcast a presence update to all subscribers watching this user.
pub async fn broadcast_presence_update(
    state: &AppState,
    user_id: UserId,
    status: UserStatus,
    last_active: Option<i64>,
) {
    // Get watchers (lock-free via DashMap)
    let watchers = state.connections.get_watchers(&user_id);

    if watchers.is_empty() {
        return;
    }

    let server_message = ServerMessage::PresenceUpdate {
        user_id,
        status,
        last_active,
    };

    let data = match chai_protocol::json::encode_server_message(&server_message) {
        Ok(d) => d,
        Err(e) => {
            tracing::error!("Failed to encode presence update: {}", e);
            return;
        }
    };

    let outgoing = OutgoingMessage::from_vec(data.into_bytes());

    // Send to all watchers (lock-free)
    let watcher_count = watchers.len();
    for watcher_id in watchers {
        state
            .connections
            .send_to_user(&watcher_id, outgoing.clone())
            .await;
    }

    tracing::debug!(
        "Broadcasted presence update for {:?} ({:?}) to {} watchers",
        user_id,
        status,
        watcher_count
    );
}

/// Broadcast presence updates for users who have become away due to inactivity.
pub async fn broadcast_away_updates(state: &AppState) {
    // Check away timeouts (lock-free via DashMap)
    let away_users = state.connections.check_away_timeouts();

    for user_id in away_users {
        let last_active = state.connections.get_last_active(&user_id);
        broadcast_presence_update(state, user_id, UserStatus::Away, last_active).await;
    }
}
