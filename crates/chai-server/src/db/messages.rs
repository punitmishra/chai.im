//! Message database operations.
//!
//! This module provides message persistence with support for batch inserts
//! to improve throughput under high message volume.

use sqlx::{FromRow, PgPool};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use tokio::time::interval;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub recipient_id: Uuid,
    pub ciphertext: Vec<u8>,
    pub message_type: i16,
    pub created_at: time::OffsetDateTime,
    pub delivered_at: Option<time::OffsetDateTime>,
}

/// Message with thread information.
#[derive(Debug, FromRow)]
pub struct MessageWithThread {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub recipient_id: Uuid,
    pub ciphertext: Vec<u8>,
    pub message_type: i16,
    pub created_at: time::OffsetDateTime,
    pub delivered_at: Option<time::OffsetDateTime>,
    pub thread_id: Option<Uuid>,
    pub reply_count: Option<i32>,
    pub latest_reply_at: Option<time::OffsetDateTime>,
}

/// Thread reply message (subset of fields for thread responses).
#[derive(Debug, FromRow)]
pub struct ThreadMessage {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub ciphertext: Vec<u8>,
    pub message_type: i16,
    pub created_at: time::OffsetDateTime,
}

/// Thread statistics.
#[derive(Debug, FromRow)]
pub struct ThreadStats {
    pub reply_count: i32,
    pub latest_reply_at: Option<time::OffsetDateTime>,
}

/// Store an encrypted message.
pub async fn store_message(
    pool: &PgPool,
    sender_id: Uuid,
    recipient_id: Uuid,
    ciphertext: &[u8],
    message_type: i16,
) -> sqlx::Result<Message> {
    sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (sender_id, recipient_id, ciphertext, message_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id, sender_id, recipient_id, ciphertext, message_type, created_at, delivered_at
        "#,
    )
    .bind(sender_id)
    .bind(recipient_id)
    .bind(ciphertext)
    .bind(message_type)
    .fetch_one(pool)
    .await
}

/// Get undelivered messages for a user.
pub async fn get_undelivered(pool: &PgPool, recipient_id: Uuid) -> sqlx::Result<Vec<Message>> {
    sqlx::query_as::<_, Message>(
        r#"
        SELECT id, sender_id, recipient_id, ciphertext, message_type, created_at, delivered_at
        FROM messages
        WHERE recipient_id = $1 AND delivered_at IS NULL
        ORDER BY created_at ASC
        "#,
    )
    .bind(recipient_id)
    .fetch_all(pool)
    .await
}

/// Mark messages as delivered.
pub async fn mark_delivered(pool: &PgPool, message_ids: &[Uuid]) -> sqlx::Result<u64> {
    let result = sqlx::query(
        r#"
        UPDATE messages
        SET delivered_at = NOW()
        WHERE id = ANY($1) AND delivered_at IS NULL
        "#,
    )
    .bind(message_ids)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Delete old delivered messages (for cleanup).
pub async fn delete_old_delivered(pool: &PgPool, days: i32) -> sqlx::Result<u64> {
    let result = sqlx::query(
        r#"
        DELETE FROM messages
        WHERE delivered_at IS NOT NULL
          AND delivered_at < NOW() - INTERVAL '1 day' * $1
        "#,
    )
    .bind(days)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Create a thread reply message.
/// This stores a message with a thread_id reference and updates the parent message's reply statistics.
pub async fn create_thread_reply(
    pool: &PgPool,
    sender_id: Uuid,
    recipient_id: Uuid,
    thread_id: Uuid,
    ciphertext: &[u8],
    message_type: i16,
) -> sqlx::Result<Message> {
    // Start a transaction to ensure atomicity
    let mut tx = pool.begin().await?;

    // Insert the reply message with thread_id
    let reply = sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (sender_id, recipient_id, ciphertext, message_type, thread_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, sender_id, recipient_id, ciphertext, message_type, created_at, delivered_at
        "#,
    )
    .bind(sender_id)
    .bind(recipient_id)
    .bind(ciphertext)
    .bind(message_type)
    .bind(thread_id)
    .fetch_one(&mut *tx)
    .await?;

    // Update the parent message's reply count and latest_reply_at
    sqlx::query(
        r#"
        UPDATE messages
        SET reply_count = COALESCE(reply_count, 0) + 1,
            latest_reply_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(thread_id)
    .execute(&mut *tx)
    .await?;

    // Add sender to thread participants if not already there
    sqlx::query(
        r#"
        INSERT INTO thread_participants (thread_id, user_id, last_read_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = NOW()
        "#,
    )
    .bind(thread_id)
    .bind(sender_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(reply)
}

/// Get messages in a thread with pagination.
/// Returns messages ordered by creation time (oldest first).
pub async fn get_thread_messages(
    pool: &PgPool,
    thread_id: Uuid,
    limit: u32,
    before: Option<Uuid>,
) -> sqlx::Result<Vec<ThreadMessage>> {
    if let Some(before_id) = before {
        // Paginated query: get messages before the specified message
        sqlx::query_as::<_, ThreadMessage>(
            r#"
            SELECT id, sender_id, ciphertext, message_type, created_at
            FROM messages
            WHERE thread_id = $1
              AND created_at < (SELECT created_at FROM messages WHERE id = $2)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(thread_id)
        .bind(before_id)
        .bind(limit as i64)
        .fetch_all(pool)
        .await
    } else {
        // Initial query: get the most recent messages
        sqlx::query_as::<_, ThreadMessage>(
            r#"
            SELECT id, sender_id, ciphertext, message_type, created_at
            FROM messages
            WHERE thread_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(thread_id)
        .bind(limit as i64)
        .fetch_all(pool)
        .await
    }
}

/// Update thread statistics (reply_count and latest_reply_at).
/// This is typically called after adding a reply to update the parent message.
pub async fn update_thread_stats(pool: &PgPool, thread_id: Uuid) -> sqlx::Result<ThreadStats> {
    sqlx::query_as::<_, ThreadStats>(
        r#"
        UPDATE messages
        SET reply_count = (
            SELECT COUNT(*) FROM messages WHERE thread_id = $1
        ),
        latest_reply_at = (
            SELECT MAX(created_at) FROM messages WHERE thread_id = $1
        )
        WHERE id = $1
        RETURNING reply_count, latest_reply_at
        "#,
    )
    .bind(thread_id)
    .fetch_one(pool)
    .await
}

/// Get thread statistics for a message.
pub async fn get_thread_stats(pool: &PgPool, thread_id: Uuid) -> sqlx::Result<Option<ThreadStats>> {
    sqlx::query_as::<_, ThreadStats>(
        r#"
        SELECT COALESCE(reply_count, 0) as reply_count, latest_reply_at
        FROM messages
        WHERE id = $1
        "#,
    )
    .bind(thread_id)
    .fetch_optional(pool)
    .await
}

/// Get all participants in a thread (users who have replied).
pub async fn get_thread_participants(pool: &PgPool, thread_id: Uuid) -> sqlx::Result<Vec<Uuid>> {
    let rows = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT user_id FROM thread_participants WHERE thread_id = $1
        "#,
    )
    .bind(thread_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get the parent message of a thread to find the recipient for notifications.
pub async fn get_message_by_id(pool: &PgPool, message_id: Uuid) -> sqlx::Result<Option<Message>> {
    sqlx::query_as::<_, Message>(
        r#"
        SELECT id, sender_id, recipient_id, ciphertext, message_type, created_at, delivered_at
        FROM messages
        WHERE id = $1
        "#,
    )
    .bind(message_id)
    .fetch_optional(pool)
    .await
}

// =============================================================================
// Message Batching for High-Throughput Inserts
// =============================================================================

/// Default flush interval for message batching (100ms).
const DEFAULT_FLUSH_INTERVAL: Duration = Duration::from_millis(100);

/// Default maximum batch size before forced flush.
const DEFAULT_MAX_BATCH_SIZE: usize = 100;

/// Channel buffer size for pending messages.
const BATCH_CHANNEL_SIZE: usize = 1000;

/// A pending message to be inserted.
#[derive(Debug, Clone)]
pub struct PendingMessage {
    /// Pre-generated message ID for immediate return to caller.
    pub id: Uuid,
    /// Sender user ID.
    pub sender_id: Uuid,
    /// Recipient user ID.
    pub recipient_id: Uuid,
    /// Encrypted message content.
    pub ciphertext: Vec<u8>,
    /// Message type (prekey, normal, etc.).
    pub message_type: i16,
    /// Optional thread ID for threaded replies.
    pub thread_id: Option<Uuid>,
}

impl PendingMessage {
    /// Create a new pending message with an auto-generated ID.
    pub fn new(
        sender_id: Uuid,
        recipient_id: Uuid,
        ciphertext: Vec<u8>,
        message_type: i16,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            sender_id,
            recipient_id,
            ciphertext,
            message_type,
            thread_id: None,
        }
    }

    /// Create a new pending message as a thread reply.
    pub fn new_thread_reply(
        sender_id: Uuid,
        recipient_id: Uuid,
        thread_id: Uuid,
        ciphertext: Vec<u8>,
        message_type: i16,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            sender_id,
            recipient_id,
            ciphertext,
            message_type,
            thread_id: Some(thread_id),
        }
    }
}

/// Result from submitting a message to the batcher.
#[derive(Debug)]
pub struct BatchedMessageResult {
    /// The pre-generated message ID (available immediately).
    pub id: Uuid,
}

/// Configuration for the message batcher.
#[derive(Debug, Clone)]
pub struct MessageBatcherConfig {
    /// How often to flush pending messages to the database.
    pub flush_interval: Duration,
    /// Maximum number of messages to batch before forcing a flush.
    pub max_batch_size: usize,
}

impl Default for MessageBatcherConfig {
    fn default() -> Self {
        Self {
            flush_interval: DEFAULT_FLUSH_INTERVAL,
            max_batch_size: DEFAULT_MAX_BATCH_SIZE,
        }
    }
}

/// High-throughput message batcher that groups inserts for efficiency.
///
/// The batcher collects messages and periodically flushes them to the database
/// in a single batch INSERT statement. This significantly reduces database
/// round-trips under high message volume.
///
/// # Example
///
/// ```ignore
/// let batcher = MessageBatcher::new(pool.clone(), MessageBatcherConfig::default());
/// batcher.start();
///
/// // Submit messages (returns immediately with pre-generated ID)
/// let result = batcher.submit(PendingMessage::new(
///     sender_id,
///     recipient_id,
///     ciphertext,
///     message_type,
/// )).await?;
///
/// // Use result.id immediately for real-time notifications
/// ```
pub struct MessageBatcher {
    /// Database connection pool.
    pool: PgPool,
    /// Configuration.
    config: MessageBatcherConfig,
    /// Channel sender for submitting messages.
    tx: mpsc::Sender<PendingMessage>,
    /// Channel receiver (held by the background task).
    rx: Arc<Mutex<mpsc::Receiver<PendingMessage>>>,
}

impl MessageBatcher {
    /// Create a new message batcher.
    pub fn new(pool: PgPool, config: MessageBatcherConfig) -> Self {
        let (tx, rx) = mpsc::channel(BATCH_CHANNEL_SIZE);
        Self {
            pool,
            config,
            tx,
            rx: Arc::new(Mutex::new(rx)),
        }
    }

    /// Create a batcher with default configuration.
    pub fn with_defaults(pool: PgPool) -> Self {
        Self::new(pool, MessageBatcherConfig::default())
    }

    /// Start the background flush task.
    ///
    /// This spawns a tokio task that periodically flushes pending messages
    /// to the database. The task runs until the batcher is dropped.
    pub fn start(&self) -> tokio::task::JoinHandle<()> {
        let pool = self.pool.clone();
        let config = self.config.clone();
        let rx = Arc::clone(&self.rx);

        tokio::spawn(async move {
            let mut batch: Vec<PendingMessage> = Vec::with_capacity(config.max_batch_size);
            let mut flush_timer = interval(config.flush_interval);

            loop {
                let mut rx_guard = rx.lock().await;

                tokio::select! {
                    // Check for new messages
                    msg = rx_guard.recv() => {
                        match msg {
                            Some(pending) => {
                                batch.push(pending);

                                // Force flush if batch is full
                                if batch.len() >= config.max_batch_size {
                                    drop(rx_guard); // Release lock before flush
                                    if let Err(e) = flush_batch(&pool, &mut batch).await {
                                        tracing::error!("Failed to flush message batch: {}", e);
                                    }
                                }
                            }
                            None => {
                                // Channel closed, flush remaining and exit
                                drop(rx_guard);
                                if !batch.is_empty() {
                                    let _ = flush_batch(&pool, &mut batch).await;
                                }
                                tracing::info!("Message batcher shutting down");
                                break;
                            }
                        }
                    }

                    // Periodic flush
                    _ = flush_timer.tick() => {
                        if !batch.is_empty() {
                            drop(rx_guard); // Release lock before flush
                            if let Err(e) = flush_batch(&pool, &mut batch).await {
                                tracing::error!("Failed to flush message batch: {}", e);
                            }
                        }
                    }
                }
            }
        })
    }

    /// Submit a message to be batched and inserted.
    ///
    /// Returns immediately with the pre-generated message ID.
    /// The actual database insert happens asynchronously.
    pub async fn submit(
        &self,
        message: PendingMessage,
    ) -> Result<BatchedMessageResult, mpsc::error::SendError<PendingMessage>> {
        let id = message.id;
        self.tx.send(message).await?;
        Ok(BatchedMessageResult { id })
    }

    /// Try to submit a message without waiting.
    ///
    /// Returns immediately with the message ID if successful,
    /// or an error if the channel is full.
    pub fn try_submit(
        &self,
        message: PendingMessage,
    ) -> Result<BatchedMessageResult, mpsc::error::TrySendError<PendingMessage>> {
        let id = message.id;
        self.tx.try_send(message)?;
        Ok(BatchedMessageResult { id })
    }

    /// Get a clone of the sender for use in multiple tasks.
    pub fn sender(&self) -> mpsc::Sender<PendingMessage> {
        self.tx.clone()
    }
}

/// Flush a batch of pending messages to the database.
///
/// Uses a single multi-value INSERT statement for efficiency.
/// Preserves message ordering by insertion order.
async fn flush_batch(pool: &PgPool, batch: &mut Vec<PendingMessage>) -> sqlx::Result<()> {
    if batch.is_empty() {
        return Ok(());
    }

    let batch_size = batch.len();
    tracing::debug!("Flushing batch of {} messages", batch_size);

    // Build a multi-value INSERT statement
    // PostgreSQL supports up to ~1000 parameters, with 6 params per row that's ~166 rows max
    // We chunk if necessary, though max_batch_size should prevent this

    // Build the query dynamically
    let mut query = String::from(
        "INSERT INTO messages (id, sender_id, recipient_id, ciphertext, message_type, thread_id) VALUES ",
    );

    let mut param_idx = 1;
    for (i, _msg) in batch.iter().enumerate() {
        if i > 0 {
            query.push_str(", ");
        }
        query.push_str(&format!(
            "(${}, ${}, ${}, ${}, ${}, ${})",
            param_idx,
            param_idx + 1,
            param_idx + 2,
            param_idx + 3,
            param_idx + 4,
            param_idx + 5
        ));
        param_idx += 6;
    }

    // Execute with all parameters
    let mut q = sqlx::query(&query);
    for msg in batch.iter() {
        q = q
            .bind(msg.id)
            .bind(msg.sender_id)
            .bind(msg.recipient_id)
            .bind(&msg.ciphertext)
            .bind(msg.message_type)
            .bind(msg.thread_id);
    }

    q.execute(pool).await?;

    tracing::debug!("Successfully flushed {} messages", batch_size);
    batch.clear();

    Ok(())
}

/// Batch insert multiple messages at once.
///
/// This is a simpler alternative to the batcher for cases where you already
/// have a collection of messages to insert.
pub async fn batch_insert_messages(
    pool: &PgPool,
    messages: &[PendingMessage],
) -> sqlx::Result<u64> {
    if messages.is_empty() {
        return Ok(0);
    }

    // Build the multi-value INSERT
    let mut query = String::from(
        "INSERT INTO messages (id, sender_id, recipient_id, ciphertext, message_type, thread_id) VALUES ",
    );

    let mut param_idx = 1;
    for (i, _msg) in messages.iter().enumerate() {
        if i > 0 {
            query.push_str(", ");
        }
        query.push_str(&format!(
            "(${}, ${}, ${}, ${}, ${}, ${})",
            param_idx,
            param_idx + 1,
            param_idx + 2,
            param_idx + 3,
            param_idx + 4,
            param_idx + 5
        ));
        param_idx += 6;
    }

    let mut q = sqlx::query(&query);
    for msg in messages {
        q = q
            .bind(msg.id)
            .bind(msg.sender_id)
            .bind(msg.recipient_id)
            .bind(&msg.ciphertext)
            .bind(msg.message_type)
            .bind(msg.thread_id);
    }

    let result = q.execute(pool).await?;
    Ok(result.rows_affected())
}
