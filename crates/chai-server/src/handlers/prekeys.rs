//! Prekey management handlers.

use crate::error::{AppError, Result};
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    Json,
};
use chai_protocol::{PrekeyBundleData, OneTimePrekey};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct GetBundleResponse {
    pub bundle: Option<PrekeyBundleData>,
}

/// Get a user's prekey bundle.
pub async fn get_bundle(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<GetBundleResponse>> {
    // TODO: Fetch from database
    // TODO: Consume one-time prekey

    Ok(Json(GetBundleResponse { bundle: None }))
}

#[derive(Debug, Deserialize)]
pub struct UploadBundleRequest {
    pub bundle: PrekeyBundleData,
}

#[derive(Debug, Serialize)]
pub struct UploadBundleResponse {
    pub success: bool,
}

/// Upload a prekey bundle.
pub async fn upload_bundle(
    State(state): State<Arc<AppState>>,
    Json(req): Json<UploadBundleRequest>,
) -> Result<Json<UploadBundleResponse>> {
    // TODO: Verify user is authenticated
    // TODO: Store in database

    Ok(Json(UploadBundleResponse { success: true }))
}

#[derive(Debug, Deserialize)]
pub struct UploadOneTimeRequest {
    pub prekeys: Vec<OneTimePrekey>,
}

#[derive(Debug, Serialize)]
pub struct UploadOneTimeResponse {
    pub count: usize,
}

/// Upload one-time prekeys.
pub async fn upload_one_time(
    State(state): State<Arc<AppState>>,
    Json(req): Json<UploadOneTimeRequest>,
) -> Result<Json<UploadOneTimeResponse>> {
    // TODO: Store in database
    let count = req.prekeys.len();

    Ok(Json(UploadOneTimeResponse { count }))
}
