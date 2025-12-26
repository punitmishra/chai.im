//! Prekey database operations.

use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct PrekeyBundle {
    pub id: Uuid,
    pub user_id: Uuid,
    pub signed_prekey: Vec<u8>,
    pub signed_prekey_signature: Vec<u8>,
    pub prekey_id: i32,
    pub created_at: time::OffsetDateTime,
}

#[derive(Debug, FromRow)]
pub struct OneTimePrekey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub prekey: Vec<u8>,
    pub prekey_id: i32,
    pub used: bool,
    pub created_at: time::OffsetDateTime,
}

/// Store a signed prekey bundle.
pub async fn store_prekey_bundle(
    pool: &PgPool,
    user_id: Uuid,
    signed_prekey: &[u8],
    signature: &[u8],
    prekey_id: i32,
) -> sqlx::Result<PrekeyBundle> {
    sqlx::query_as::<_, PrekeyBundle>(
        r#"
        INSERT INTO prekey_bundles (user_id, signed_prekey, signed_prekey_signature, prekey_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, prekey_id) DO UPDATE SET
            signed_prekey = EXCLUDED.signed_prekey,
            signed_prekey_signature = EXCLUDED.signed_prekey_signature
        RETURNING id, user_id, signed_prekey, signed_prekey_signature, prekey_id, created_at
        "#,
    )
    .bind(user_id)
    .bind(signed_prekey)
    .bind(signature)
    .bind(prekey_id)
    .fetch_one(pool)
    .await
}

/// Get a user's current prekey bundle.
pub async fn get_prekey_bundle(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Option<PrekeyBundle>> {
    sqlx::query_as::<_, PrekeyBundle>(
        r#"
        SELECT id, user_id, signed_prekey, signed_prekey_signature, prekey_id, created_at
        FROM prekey_bundles
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// Store one-time prekeys.
pub async fn store_one_time_prekeys(
    pool: &PgPool,
    user_id: Uuid,
    prekeys: &[(i32, Vec<u8>)],
) -> sqlx::Result<usize> {
    let mut count = 0;

    for (prekey_id, prekey) in prekeys {
        sqlx::query(
            r#"
            INSERT INTO one_time_prekeys (user_id, prekey, prekey_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(prekey)
        .bind(*prekey_id)
        .execute(pool)
        .await?;

        count += 1;
    }

    Ok(count)
}

/// Consume a one-time prekey for a user.
pub async fn consume_one_time_prekey(
    pool: &PgPool,
    user_id: Uuid,
) -> sqlx::Result<Option<OneTimePrekey>> {
    sqlx::query_as::<_, OneTimePrekey>(
        r#"
        UPDATE one_time_prekeys
        SET used = true
        WHERE id = (
            SELECT id FROM one_time_prekeys
            WHERE user_id = $1 AND used = false
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, user_id, prekey, prekey_id, used, created_at
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// Count available one-time prekeys for a user.
pub async fn count_one_time_prekeys(pool: &PgPool, user_id: Uuid) -> sqlx::Result<i64> {
    let row: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM one_time_prekeys
        WHERE user_id = $1 AND used = false
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}
