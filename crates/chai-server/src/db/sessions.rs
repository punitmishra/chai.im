//! Session database operations.

use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub device_id: Uuid,
    pub token_hash: Vec<u8>,
    pub connected_at: time::OffsetDateTime,
    pub last_seen: time::OffsetDateTime,
    pub expires_at: time::OffsetDateTime,
}

/// Create a new session.
pub async fn create_session(
    pool: &PgPool,
    user_id: Uuid,
    device_id: Uuid,
    token_hash: &[u8],
    expires_at: time::OffsetDateTime,
) -> sqlx::Result<Session> {
    sqlx::query_as::<_, Session>(
        r#"
        INSERT INTO sessions (user_id, device_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, device_id, token_hash, connected_at, last_seen, expires_at
        "#,
    )
    .bind(user_id)
    .bind(device_id)
    .bind(token_hash)
    .bind(expires_at)
    .fetch_one(pool)
    .await
}

/// Get a session by token hash.
pub async fn get_by_token_hash(
    pool: &PgPool,
    token_hash: &[u8],
) -> sqlx::Result<Option<Session>> {
    sqlx::query_as::<_, Session>(
        r#"
        SELECT id, user_id, device_id, token_hash, connected_at, last_seen, expires_at
        FROM sessions
        WHERE token_hash = $1 AND expires_at > NOW()
        "#,
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

/// Update last_seen timestamp.
pub async fn update_last_seen(pool: &PgPool, session_id: Uuid) -> sqlx::Result<()> {
    sqlx::query(
        r#"
        UPDATE sessions
        SET last_seen = NOW()
        WHERE id = $1
        "#,
    )
    .bind(session_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Delete a session.
pub async fn delete_session(pool: &PgPool, session_id: Uuid) -> sqlx::Result<()> {
    sqlx::query(
        r#"
        DELETE FROM sessions
        WHERE id = $1
        "#,
    )
    .bind(session_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Delete expired sessions.
pub async fn cleanup_expired(pool: &PgPool) -> sqlx::Result<u64> {
    let result = sqlx::query(
        r#"
        DELETE FROM sessions
        WHERE expires_at < NOW()
        "#,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
