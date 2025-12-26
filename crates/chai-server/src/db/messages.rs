//! Message database operations.

use sqlx::{FromRow, PgPool};
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
