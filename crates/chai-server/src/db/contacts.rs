//! Contacts database operations.
//!
//! Manages peer-to-peer contact relationships for secure identity exchange.

use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct Contact {
    pub id: Uuid,
    pub user_id: Uuid,
    pub contact_user_id: Uuid,
    pub alias: Option<String>,
    pub verified: bool,
    pub created_at: time::OffsetDateTime,
    pub updated_at: time::OffsetDateTime,
}

/// Add a contact by user ID.
/// Creates a bidirectional contact relationship.
pub async fn add_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_user_id: Uuid,
    alias: Option<&str>,
) -> sqlx::Result<Contact> {
    sqlx::query_as::<_, Contact>(
        r#"
        INSERT INTO contacts (user_id, contact_user_id, alias)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, contact_user_id) DO UPDATE
        SET alias = COALESCE(EXCLUDED.alias, contacts.alias),
            updated_at = NOW()
        RETURNING id, user_id, contact_user_id, alias, verified, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .bind(alias)
    .fetch_one(pool)
    .await
}

/// Get all contacts for a user.
pub async fn get_contacts(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Vec<Contact>> {
    sqlx::query_as::<_, Contact>(
        r#"
        SELECT id, user_id, contact_user_id, alias, verified, created_at, updated_at
        FROM contacts
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Check if a contact relationship exists.
pub async fn contact_exists(
    pool: &PgPool,
    user_id: Uuid,
    contact_user_id: Uuid,
) -> sqlx::Result<bool> {
    let row: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM contacts
            WHERE user_id = $1 AND contact_user_id = $2
        )
        "#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

/// Mark a contact as verified (safety number confirmed).
pub async fn verify_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_user_id: Uuid,
) -> sqlx::Result<Option<Contact>> {
    sqlx::query_as::<_, Contact>(
        r#"
        UPDATE contacts
        SET verified = true, updated_at = NOW()
        WHERE user_id = $1 AND contact_user_id = $2
        RETURNING id, user_id, contact_user_id, alias, verified, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .fetch_optional(pool)
    .await
}

/// Remove a contact.
pub async fn remove_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_user_id: Uuid,
) -> sqlx::Result<bool> {
    let result = sqlx::query(
        r#"
        DELETE FROM contacts
        WHERE user_id = $1 AND contact_user_id = $2
        "#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Update contact alias.
pub async fn update_alias(
    pool: &PgPool,
    user_id: Uuid,
    contact_user_id: Uuid,
    alias: Option<&str>,
) -> sqlx::Result<Option<Contact>> {
    sqlx::query_as::<_, Contact>(
        r#"
        UPDATE contacts
        SET alias = $3, updated_at = NOW()
        WHERE user_id = $1 AND contact_user_id = $2
        RETURNING id, user_id, contact_user_id, alias, verified, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .bind(alias)
    .fetch_optional(pool)
    .await
}
