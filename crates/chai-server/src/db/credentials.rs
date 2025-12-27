//! WebAuthn credential database operations.

use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct WebAuthnCredential {
    pub id: Uuid,
    pub user_id: Uuid,
    pub credential_id: Vec<u8>,
    pub public_key: Vec<u8>,
    pub counter: i32,
    pub created_at: time::OffsetDateTime,
}

/// Store a new WebAuthn credential.
pub async fn create_credential(
    pool: &PgPool,
    user_id: Uuid,
    credential_id: &[u8],
    public_key: &[u8],
    counter: u32,
) -> sqlx::Result<WebAuthnCredential> {
    sqlx::query_as::<_, WebAuthnCredential>(
        r#"
        INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, credential_id, public_key, counter, created_at
        "#,
    )
    .bind(user_id)
    .bind(credential_id)
    .bind(public_key)
    .bind(counter as i32)
    .fetch_one(pool)
    .await
}

/// Get all credentials for a user.
pub async fn get_by_user_id(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Vec<WebAuthnCredential>> {
    sqlx::query_as::<_, WebAuthnCredential>(
        r#"
        SELECT id, user_id, credential_id, public_key, counter, created_at
        FROM webauthn_credentials
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Get a credential by credential_id.
pub async fn get_by_credential_id(
    pool: &PgPool,
    credential_id: &[u8],
) -> sqlx::Result<Option<WebAuthnCredential>> {
    sqlx::query_as::<_, WebAuthnCredential>(
        r#"
        SELECT id, user_id, credential_id, public_key, counter, created_at
        FROM webauthn_credentials
        WHERE credential_id = $1
        "#,
    )
    .bind(credential_id)
    .fetch_optional(pool)
    .await
}

/// Update the counter for a credential after successful authentication.
pub async fn update_counter(
    pool: &PgPool,
    credential_id: &[u8],
    new_counter: u32,
) -> sqlx::Result<()> {
    sqlx::query(
        r#"
        UPDATE webauthn_credentials
        SET counter = $2
        WHERE credential_id = $1
        "#,
    )
    .bind(credential_id)
    .bind(new_counter as i32)
    .execute(pool)
    .await?;

    Ok(())
}
