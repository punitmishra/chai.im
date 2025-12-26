//! User database operations.

use sqlx::{FromRow, PgPool, Row};
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub identity_key: Vec<u8>,
    pub created_at: time::OffsetDateTime,
    pub updated_at: time::OffsetDateTime,
}

/// Create a new user.
pub async fn create_user(
    pool: &PgPool,
    username: &str,
    identity_key: &[u8],
) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (username, identity_key)
        VALUES ($1, $2)
        RETURNING id, username, identity_key, created_at, updated_at
        "#,
    )
    .bind(username)
    .bind(identity_key)
    .fetch_one(pool)
    .await
}

/// Get a user by username.
pub async fn get_by_username(pool: &PgPool, username: &str) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT id, username, identity_key, created_at, updated_at
        FROM users
        WHERE username = $1
        "#,
    )
    .bind(username)
    .fetch_optional(pool)
    .await
}

/// Get a user by ID.
pub async fn get_by_id(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT id, username, identity_key, created_at, updated_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Check if a username exists.
pub async fn username_exists(pool: &PgPool, username: &str) -> sqlx::Result<bool> {
    let row: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)
        "#,
    )
    .bind(username)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

/// Search result - only returns public user info (no identity_key).
#[derive(Debug, FromRow)]
pub struct UserSearchResult {
    pub id: Uuid,
    pub username: String,
    pub created_at: time::OffsetDateTime,
}

/// Search users by username prefix.
/// Excludes the searching user from results.
/// Returns up to `limit` results.
pub async fn search_by_username(
    pool: &PgPool,
    query: &str,
    exclude_user_id: Uuid,
    limit: i64,
) -> sqlx::Result<Vec<UserSearchResult>> {
    sqlx::query_as::<_, UserSearchResult>(
        r#"
        SELECT id, username, created_at
        FROM users
        WHERE username ILIKE $1
          AND id != $2
        ORDER BY username ASC
        LIMIT $3
        "#,
    )
    .bind(format!("{}%", query))
    .bind(exclude_user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}
