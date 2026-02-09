//! File attachment database operations.

use sqlx::PgPool;
use uuid::Uuid;

/// Attachment record from the database.
#[derive(Debug, sqlx::FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub uploader_id: Uuid,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub storage_path: String,
    pub created_at: time::OffsetDateTime,
}

/// Store a new attachment record.
pub async fn store_attachment(
    pool: &PgPool,
    uploader_id: Uuid,
    filename: &str,
    content_type: &str,
    size_bytes: i64,
    storage_path: &str,
) -> Result<Attachment, sqlx::Error> {
    sqlx::query_as::<_, Attachment>(
        r#"
        INSERT INTO attachments (uploader_id, filename, content_type, size_bytes, storage_path)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, uploader_id, filename, content_type, size_bytes, storage_path, created_at
        "#,
    )
    .bind(uploader_id)
    .bind(filename)
    .bind(content_type)
    .bind(size_bytes)
    .bind(storage_path)
    .fetch_one(pool)
    .await
}

/// Get an attachment by ID.
pub async fn get_attachment(pool: &PgPool, id: Uuid) -> Result<Option<Attachment>, sqlx::Error> {
    sqlx::query_as::<_, Attachment>(
        "SELECT id, uploader_id, filename, content_type, size_bytes, storage_path, created_at FROM attachments WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}
