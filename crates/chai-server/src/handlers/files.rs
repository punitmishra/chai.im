//! File attachment upload/download handlers.

use crate::db::files;
use crate::error::{AppError, Result};
use crate::handlers::users::authenticate_request;
use crate::state::AppState;
use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

/// Maximum file size: 25 MB.
const MAX_FILE_SIZE: usize = 25 * 1024 * 1024;

/// Upload directory relative to working directory.
const UPLOAD_DIR: &str = "uploads";

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub id: String,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: i64,
}

/// Upload a file attachment.
/// Expects multipart/form-data with a "file" field.
pub async fn upload(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadResponse>)> {
    let auth_user = authenticate_request(&state, &headers).await?;

    // Ensure upload directory exists
    tokio::fs::create_dir_all(UPLOAD_DIR)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create upload dir: {}", e)))?;

    // Process multipart fields
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::InvalidRequest(format!("Invalid multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != "file" {
            continue;
        }

        let filename = field.file_name().unwrap_or("unnamed").to_string();
        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        // Read file data with size limit
        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::InvalidRequest(format!("Failed to read file: {}", e)))?;

        if data.len() > MAX_FILE_SIZE {
            return Err(AppError::InvalidRequest(format!(
                "File too large. Maximum size is {} MB",
                MAX_FILE_SIZE / (1024 * 1024)
            )));
        }

        if data.is_empty() {
            return Err(AppError::InvalidRequest("Empty file".into()));
        }

        // Generate unique storage path
        let file_id = Uuid::new_v4();
        let extension = std::path::Path::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let storage_filename = format!("{}.{}", file_id, extension);
        let storage_path = format!("{}/{}", UPLOAD_DIR, storage_filename);

        // Write file to disk
        let mut file = tokio::fs::File::create(&storage_path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;
        file.write_all(&data)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;

        let size_bytes = data.len() as i64;

        // Store metadata in database
        let attachment = files::store_attachment(
            &state.db,
            auth_user.user_id,
            &filename,
            &content_type,
            size_bytes,
            &storage_path,
        )
        .await?;

        return Ok((
            StatusCode::CREATED,
            Json(UploadResponse {
                id: attachment.id.to_string(),
                filename: attachment.filename,
                content_type: attachment.content_type,
                size_bytes: attachment.size_bytes,
            }),
        ));
    }

    Err(AppError::InvalidRequest("No file field in upload".into()))
}

/// Download a file attachment by ID.
pub async fn download(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(file_id): Path<String>,
) -> Result<impl IntoResponse> {
    let _auth_user = authenticate_request(&state, &headers).await?;

    let file_id = Uuid::parse_str(&file_id)
        .map_err(|_| AppError::InvalidRequest("Invalid file ID".into()))?;

    let attachment = files::get_attachment(&state.db, file_id)
        .await?
        .ok_or_else(|| AppError::NotFound("File not found".into()))?;

    // Read file from disk
    let data = tokio::fs::read(&attachment.storage_path)
        .await
        .map_err(|_| AppError::NotFound("File data not found".into()))?;

    let headers = [
        (header::CONTENT_TYPE, attachment.content_type),
        (
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", attachment.filename),
        ),
    ];

    Ok((headers, Body::from(data)))
}
