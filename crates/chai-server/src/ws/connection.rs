//! WebSocket connection management with high-performance concurrent data structures.
//!
//! This module provides lock-free connection management using DashMap for O(1) concurrent
//! access, SmallVec for optimized multi-device storage, and broadcast channels for
//! efficient presence fanout.

use bytes::Bytes;
use chai_common::UserId;
use chai_protocol::UserStatus;
use dashmap::DashMap;
use smallvec::SmallVec;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, mpsc};

/// Maximum number of device connections to inline in SmallVec before heap allocation.
/// Most users have fewer than 4 devices connected simultaneously.
const INLINE_DEVICE_CAPACITY: usize = 4;

/// Broadcast channel capacity for presence updates.
const PRESENCE_BROADCAST_CAPACITY: usize = 1024;

/// Duration of inactivity before a user is marked as away (5 minutes).
pub const AWAY_TIMEOUT: Duration = Duration::from_secs(5 * 60);

/// Get current time in milliseconds since Unix epoch.
fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Message to send to a connected client.
/// Uses `Bytes` for zero-copy message passing.
#[derive(Debug, Clone)]
pub struct OutgoingMessage {
    /// The message data. Using `Bytes` allows zero-copy cloning.
    pub data: Bytes,
}

impl OutgoingMessage {
    /// Create a new outgoing message from bytes.
    pub fn new(data: impl Into<Bytes>) -> Self {
        Self { data: data.into() }
    }

    /// Create from a Vec<u8> (zero-copy conversion).
    pub fn from_vec(data: Vec<u8>) -> Self {
        Self {
            data: Bytes::from(data),
        }
    }
}

// Provide conversion from Vec<u8> for backwards compatibility
impl From<Vec<u8>> for OutgoingMessage {
    fn from(data: Vec<u8>) -> Self {
        Self::from_vec(data)
    }
}

/// Presence event broadcast to subscribers.
#[derive(Debug, Clone)]
pub enum PresenceEvent {
    /// User came online.
    Online(UserId),
    /// User went offline.
    Offline(UserId),
    /// User status changed.
    StatusChanged(UserId, UserStatus),
}

/// Presence information for a user.
#[derive(Debug, Clone)]
pub struct PresenceInfo {
    /// Current status (Active, Away, DoNotDisturb, Offline).
    pub status: UserStatus,
    /// Instant of last activity (for auto-away calculation).
    pub last_activity: Instant,
    /// Unix timestamp in milliseconds of last activity.
    pub last_active_ms: i64,
    /// Whether the user manually set DND mode.
    pub manual_dnd: bool,
}

impl PresenceInfo {
    /// Create new presence info with Active status.
    pub fn new() -> Self {
        Self {
            status: UserStatus::Active,
            last_activity: Instant::now(),
            last_active_ms: current_time_ms(),
            manual_dnd: false,
        }
    }

    /// Check if user should be marked as away based on inactivity.
    pub fn should_be_away(&self) -> bool {
        !self.manual_dnd && self.last_activity.elapsed() >= AWAY_TIMEOUT
    }

    /// Update last activity time.
    pub fn touch(&mut self) {
        self.last_activity = Instant::now();
        self.last_active_ms = current_time_ms();
        if !self.manual_dnd {
            self.status = UserStatus::Active;
        }
    }

    /// Set status, tracking if DND is manual.
    pub fn set_status(&mut self, status: UserStatus) {
        self.status = status;
        self.manual_dnd = status == UserStatus::DoNotDisturb;
        if status == UserStatus::Active {
            self.touch();
        }
    }
}

impl Default for PresenceInfo {
    fn default() -> Self {
        Self::new()
    }
}

/// A connected client device.
pub struct DeviceConnection {
    /// User ID of the connection owner.
    pub user_id: UserId,
    /// Channel to send messages to this device.
    pub sender: mpsc::Sender<OutgoingMessage>,
    /// When this connection was established.
    pub connected_at: Instant,
    /// Number of messages sent through this connection.
    pub messages_sent: AtomicU64,
    /// Number of messages received through this connection.
    pub messages_received: AtomicU64,
}

impl DeviceConnection {
    /// Create a new device connection.
    pub fn new(user_id: UserId, sender: mpsc::Sender<OutgoingMessage>) -> Self {
        Self {
            user_id,
            sender,
            connected_at: Instant::now(),
            messages_sent: AtomicU64::new(0),
            messages_received: AtomicU64::new(0),
        }
    }

    /// Record that a message was sent.
    pub fn record_message_sent(&self) {
        self.messages_sent.fetch_add(1, Ordering::Relaxed);
    }

    /// Record that a message was received.
    pub fn record_message_received(&self) {
        self.messages_received.fetch_add(1, Ordering::Relaxed);
    }

    /// Get total messages sent.
    pub fn total_sent(&self) -> u64 {
        self.messages_sent.load(Ordering::Relaxed)
    }

    /// Get total messages received.
    pub fn total_received(&self) -> u64 {
        self.messages_received.load(Ordering::Relaxed)
    }
}

/// User connection entry containing all device connections for a user.
pub struct UserConnections {
    /// All active device connections for this user.
    /// Uses SmallVec to inline up to 4 connections (typical case).
    pub devices: SmallVec<[Arc<DeviceConnection>; INLINE_DEVICE_CAPACITY]>,
    /// Presence information for this user.
    pub presence: PresenceInfo,
}

impl UserConnections {
    /// Create a new user connections entry.
    pub fn new() -> Self {
        Self {
            devices: SmallVec::new(),
            presence: PresenceInfo::new(),
        }
    }

    /// Add a device connection.
    pub fn add_device(&mut self, conn: Arc<DeviceConnection>) {
        self.devices.push(conn);
        self.presence.touch();
    }

    /// Remove a device connection by sender channel identity.
    /// Returns true if the device was found and removed.
    pub fn remove_device(&mut self, sender: &mpsc::Sender<OutgoingMessage>) -> bool {
        let initial_len = self.devices.len();
        self.devices.retain(|c| !c.sender.same_channel(sender));
        self.devices.len() < initial_len
    }

    /// Check if this user has any active connections.
    pub fn is_empty(&self) -> bool {
        self.devices.is_empty()
    }

    /// Get the number of active device connections.
    pub fn device_count(&self) -> usize {
        self.devices.len()
    }
}

impl Default for UserConnections {
    fn default() -> Self {
        Self::new()
    }
}

/// Connection metrics for monitoring.
#[derive(Debug, Default)]
pub struct ConnectionMetrics {
    /// Total active connections across all users.
    pub total_connections: usize,
    /// Total unique online users.
    pub online_users: usize,
    /// Total messages sent across all connections.
    pub total_messages_sent: u64,
    /// Total messages received across all connections.
    pub total_messages_received: u64,
}

/// High-performance WebSocket connection manager.
///
/// Uses lock-free DashMap for concurrent access to user connections,
/// SmallVec for efficient multi-device storage, and broadcast channels
/// for presence fanout.
pub struct ConnectionManager {
    /// Map of user ID to their connections.
    /// DashMap provides lock-free concurrent access.
    connections: DashMap<UserId, UserConnections>,

    /// Presence subscriptions: subscriber -> set of users they're watching.
    subscriptions: DashMap<UserId, HashSet<UserId>>,

    /// Reverse subscriptions: user -> set of subscribers watching them.
    watchers: DashMap<UserId, HashSet<UserId>>,

    /// Broadcast channel for presence events.
    /// Subscribers receive online/offline notifications for all users.
    presence_tx: broadcast::Sender<PresenceEvent>,
}

impl ConnectionManager {
    /// Create a new connection manager.
    pub fn new() -> Self {
        let (presence_tx, _) = broadcast::channel(PRESENCE_BROADCAST_CAPACITY);
        Self {
            connections: DashMap::new(),
            subscriptions: DashMap::new(),
            watchers: DashMap::new(),
            presence_tx,
        }
    }

    /// Subscribe to presence events via broadcast channel.
    /// Returns a receiver for online/offline notifications.
    pub fn subscribe_presence_broadcast(&self) -> broadcast::Receiver<PresenceEvent> {
        self.presence_tx.subscribe()
    }

    /// Register a new connection.
    /// Returns the device connection for metrics tracking.
    pub fn add(
        &self,
        user_id: UserId,
        sender: mpsc::Sender<OutgoingMessage>,
    ) -> Arc<DeviceConnection> {
        let conn = Arc::new(DeviceConnection::new(user_id, sender));
        let was_offline = {
            let mut entry = self.connections.entry(user_id).or_default();
            let was_empty = entry.is_empty();
            entry.add_device(Arc::clone(&conn));
            was_empty
        };

        // Broadcast presence if user just came online
        if was_offline {
            let _ = self.presence_tx.send(PresenceEvent::Online(user_id));
        }

        conn
    }

    /// Remove a connection.
    /// Returns true if the user went offline (no more connections).
    pub fn remove(&self, user_id: &UserId, sender: &mpsc::Sender<OutgoingMessage>) -> bool {
        let went_offline = {
            let mut entry = match self.connections.get_mut(user_id) {
                Some(e) => e,
                None => return false,
            };
            entry.remove_device(sender);
            entry.is_empty()
        };

        // If user has no more connections, remove the entry and clean up subscriptions
        if went_offline {
            self.connections.remove(user_id);
            self.remove_all_subscriptions(user_id);
            let _ = self.presence_tx.send(PresenceEvent::Offline(*user_id));
        }

        went_offline
    }

    /// Clean up all subscriptions for a user (when they disconnect).
    fn remove_all_subscriptions(&self, user_id: &UserId) {
        // Remove user from their subscriptions
        if let Some((_, targets)) = self.subscriptions.remove(user_id) {
            for target in targets {
                if let Some(mut watchers) = self.watchers.get_mut(&target) {
                    watchers.remove(user_id);
                }
            }
        }
        // Remove user from watchers (others watching this user)
        self.watchers.remove(user_id);
    }

    /// Check if a user is online (has at least one connection).
    pub fn is_online(&self, user_id: &UserId) -> bool {
        self.connections.contains_key(user_id)
    }

    /// Get user's presence info.
    pub fn get_presence(&self, user_id: &UserId) -> Option<PresenceInfo> {
        self.connections.get(user_id).map(|e| e.presence.clone())
    }

    /// Get user's current status.
    pub fn get_status(&self, user_id: &UserId) -> UserStatus {
        self.connections
            .get(user_id)
            .map(|e| e.presence.status)
            .unwrap_or(UserStatus::Offline)
    }

    /// Get last active timestamp for a user.
    pub fn get_last_active(&self, user_id: &UserId) -> Option<i64> {
        self.connections
            .get(user_id)
            .map(|e| e.presence.last_active_ms)
    }

    /// Update user's activity timestamp.
    /// Returns true if status changed from Away to Active.
    pub fn touch_activity(&self, user_id: &UserId) -> bool {
        if let Some(mut entry) = self.connections.get_mut(user_id) {
            let was_away = entry.presence.status == UserStatus::Away;
            entry.presence.touch();
            if was_away {
                let _ = self
                    .presence_tx
                    .send(PresenceEvent::StatusChanged(*user_id, UserStatus::Active));
            }
            return was_away;
        }
        false
    }

    /// Set user's status manually.
    /// Returns true if status actually changed.
    pub fn set_status(&self, user_id: &UserId, status: UserStatus) -> bool {
        if let Some(mut entry) = self.connections.get_mut(user_id) {
            let old_status = entry.presence.status;
            entry.presence.set_status(status);
            if old_status != status {
                let _ = self
                    .presence_tx
                    .send(PresenceEvent::StatusChanged(*user_id, status));
                return true;
            }
        }
        false
    }

    /// Check and update away status for all users.
    /// Returns list of users whose status changed to Away.
    pub fn check_away_timeouts(&self) -> Vec<UserId> {
        let mut changed = Vec::new();

        for mut entry in self.connections.iter_mut() {
            if entry.presence.status == UserStatus::Active && entry.presence.should_be_away() {
                entry.presence.status = UserStatus::Away;
                changed.push(*entry.key());
            }
        }

        // Broadcast status changes
        for user_id in &changed {
            let _ = self
                .presence_tx
                .send(PresenceEvent::StatusChanged(*user_id, UserStatus::Away));
        }

        changed
    }

    /// Subscribe a user to presence updates for a list of users.
    pub fn subscribe_presence(&self, subscriber: UserId, targets: Vec<UserId>) {
        let mut subs = self.subscriptions.entry(subscriber).or_default();
        for target in targets {
            subs.insert(target);
            self.watchers.entry(target).or_default().insert(subscriber);
        }
    }

    /// Get all subscribers watching a user.
    pub fn get_watchers(&self, user_id: &UserId) -> Vec<UserId> {
        self.watchers
            .get(user_id)
            .map(|w| w.iter().copied().collect())
            .unwrap_or_default()
    }

    /// Send a message to a user (all their device connections).
    /// Returns the number of devices the message was sent to.
    pub async fn send_to_user(&self, user_id: &UserId, message: OutgoingMessage) -> usize {
        let devices = match self.connections.get(user_id) {
            Some(entry) => entry.devices.clone(),
            None => return 0,
        };

        let mut sent_count = 0;
        for device in &devices {
            if device.sender.send(message.clone()).await.is_ok() {
                device.record_message_sent();
                sent_count += 1;
            }
        }

        sent_count
    }

    /// Send a message to a user without waiting (non-blocking).
    /// Uses try_send which returns immediately.
    /// Returns the number of devices the message was sent to.
    pub fn send_to_user_nonblocking(&self, user_id: &UserId, message: OutgoingMessage) -> usize {
        let devices = match self.connections.get(user_id) {
            Some(entry) => entry.devices.clone(),
            None => return 0,
        };

        let mut sent_count = 0;
        for device in &devices {
            if device.sender.try_send(message.clone()).is_ok() {
                device.record_message_sent();
                sent_count += 1;
            }
        }

        sent_count
    }

    /// Broadcast a message to multiple users.
    /// Returns a list of (user_id, devices_reached) pairs.
    pub async fn broadcast(
        &self,
        user_ids: &[UserId],
        message: OutgoingMessage,
    ) -> Vec<(UserId, usize)> {
        let mut results = Vec::with_capacity(user_ids.len());

        for user_id in user_ids {
            let count = self.send_to_user(user_id, message.clone()).await;
            if count > 0 {
                results.push((*user_id, count));
            }
        }

        results
    }

    /// Get all online user IDs.
    pub fn online_users(&self) -> Vec<UserId> {
        self.connections.iter().map(|r| *r.key()).collect()
    }

    /// Get the number of active connections for a user.
    pub fn connection_count(&self, user_id: &UserId) -> usize {
        self.connections
            .get(user_id)
            .map(|e| e.device_count())
            .unwrap_or(0)
    }

    /// Get the total number of online users.
    pub fn online_user_count(&self) -> usize {
        self.connections.len()
    }

    /// Get the total number of active connections across all users.
    pub fn total_connection_count(&self) -> usize {
        self.connections.iter().map(|r| r.device_count()).sum()
    }

    /// Get comprehensive connection metrics.
    pub fn metrics(&self) -> ConnectionMetrics {
        let mut metrics = ConnectionMetrics::default();

        for entry in self.connections.iter() {
            metrics.online_users += 1;
            for device in &entry.devices {
                metrics.total_connections += 1;
                metrics.total_messages_sent += device.total_sent();
                metrics.total_messages_received += device.total_received();
            }
        }

        metrics
    }

    /// Get connections that have been idle for longer than the given duration.
    /// Useful for implementing connection timeouts.
    pub fn idle_connections(&self, threshold: Duration) -> Vec<UserId> {
        self.connections
            .iter()
            .filter(|r| r.presence.last_activity.elapsed() > threshold)
            .map(|r| *r.key())
            .collect()
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}

// Legacy type alias for backwards compatibility
pub type Connection = DeviceConnection;

#[cfg(test)]
mod tests {
    use super::*;

    const OUTGOING_CHANNEL_SIZE: usize = 100;

    #[tokio::test]
    async fn test_add_and_remove_connection() {
        let manager = ConnectionManager::new();
        let user_id = UserId::from(uuid::Uuid::new_v4());
        let (tx, _rx) = mpsc::channel(OUTGOING_CHANNEL_SIZE);

        // Add connection
        manager.add(user_id, tx.clone());
        assert!(manager.is_online(&user_id));
        assert_eq!(manager.connection_count(&user_id), 1);

        // Remove connection
        let went_offline = manager.remove(&user_id, &tx);
        assert!(went_offline);
        assert!(!manager.is_online(&user_id));
        assert_eq!(manager.connection_count(&user_id), 0);
    }

    #[tokio::test]
    async fn test_multiple_devices() {
        let manager = ConnectionManager::new();
        let user_id = UserId::from(uuid::Uuid::new_v4());
        let (tx1, _rx1) = mpsc::channel(OUTGOING_CHANNEL_SIZE);
        let (tx2, _rx2) = mpsc::channel(OUTGOING_CHANNEL_SIZE);

        // Add two devices
        manager.add(user_id, tx1.clone());
        manager.add(user_id, tx2.clone());
        assert_eq!(manager.connection_count(&user_id), 2);

        // Remove first device
        let went_offline = manager.remove(&user_id, &tx1);
        assert!(!went_offline); // Still has second device
        assert!(manager.is_online(&user_id));
        assert_eq!(manager.connection_count(&user_id), 1);

        // Remove second device
        let went_offline = manager.remove(&user_id, &tx2);
        assert!(went_offline);
        assert!(!manager.is_online(&user_id));
    }

    #[tokio::test]
    async fn test_send_message() {
        let manager = ConnectionManager::new();
        let user_id = UserId::from(uuid::Uuid::new_v4());
        let (tx, mut rx) = mpsc::channel(OUTGOING_CHANNEL_SIZE);

        manager.add(user_id, tx);

        let msg = OutgoingMessage::from_vec(b"hello".to_vec());
        let sent = manager.send_to_user(&user_id, msg).await;
        assert_eq!(sent, 1);

        let received = rx.recv().await.unwrap();
        assert_eq!(&received.data[..], b"hello");
    }

    #[tokio::test]
    async fn test_presence_broadcast() {
        let manager = ConnectionManager::new();
        let mut presence_rx = manager.subscribe_presence_broadcast();
        let user_id = UserId::from(uuid::Uuid::new_v4());
        let (tx, _rx) = mpsc::channel(OUTGOING_CHANNEL_SIZE);

        // Add should trigger Online event
        manager.add(user_id, tx.clone());

        // Give the broadcast channel time to process
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        if let Ok(event) = presence_rx.try_recv() {
            match event {
                PresenceEvent::Online(id) => assert_eq!(id, user_id),
                _ => panic!("Expected Online event"),
            }
        }

        // Remove should trigger Offline event
        manager.remove(&user_id, &tx);

        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        if let Ok(event) = presence_rx.try_recv() {
            match event {
                PresenceEvent::Offline(id) => assert_eq!(id, user_id),
                _ => panic!("Expected Offline event"),
            }
        }
    }

    #[tokio::test]
    async fn test_presence_info() {
        let manager = ConnectionManager::new();
        let user_id = UserId::from(uuid::Uuid::new_v4());
        let (tx, _rx) = mpsc::channel(OUTGOING_CHANNEL_SIZE);

        manager.add(user_id, tx.clone());

        // Check initial presence
        let presence = manager.get_presence(&user_id).unwrap();
        assert_eq!(presence.status, UserStatus::Active);

        // Set DND
        manager.set_status(&user_id, UserStatus::DoNotDisturb);
        let presence = manager.get_presence(&user_id).unwrap();
        assert_eq!(presence.status, UserStatus::DoNotDisturb);
        assert!(presence.manual_dnd);

        manager.remove(&user_id, &tx);
    }

    #[tokio::test]
    async fn test_presence_subscriptions() {
        let manager = ConnectionManager::new();
        let watcher = UserId::from(uuid::Uuid::new_v4());
        let target = UserId::from(uuid::Uuid::new_v4());

        manager.subscribe_presence(watcher, vec![target]);

        let watchers = manager.get_watchers(&target);
        assert_eq!(watchers.len(), 1);
        assert_eq!(watchers[0], watcher);
    }

    #[tokio::test]
    async fn test_metrics() {
        let manager = ConnectionManager::new();
        let user_id = UserId::from(uuid::Uuid::new_v4());
        let (tx, mut rx) = mpsc::channel(OUTGOING_CHANNEL_SIZE);

        manager.add(user_id, tx);

        // Send some messages
        let msg = OutgoingMessage::from_vec(b"test".to_vec());
        manager.send_to_user(&user_id, msg.clone()).await;
        manager.send_to_user(&user_id, msg).await;
        let _ = rx.recv().await;
        let _ = rx.recv().await;

        let metrics = manager.metrics();
        assert_eq!(metrics.online_users, 1);
        assert_eq!(metrics.total_connections, 1);
        assert_eq!(metrics.total_messages_sent, 2);
    }
}
