//! Prekey management handlers.

use crate::db::{prekeys, sessions, users};
use crate::error::{AppError, Result};
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::{header::AUTHORIZATION, HeaderMap},
    Json,
};
use chai_protocol::{OneTimePrekey, PrekeyBundleData};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
    // Fetch the user to get their identity key
    let user = users::get_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Fetch the prekey bundle
    let prekey_bundle = prekeys::get_prekey_bundle(&state.db, user_id).await?;

    let bundle = match prekey_bundle {
        Some(pk) => {
            // Try to consume a one-time prekey
            let otp = prekeys::consume_one_time_prekey(&state.db, user_id).await?;

            Some(PrekeyBundleData {
                identity_key: user.identity_key,
                signed_prekey: pk.signed_prekey,
                signed_prekey_signature: pk.signed_prekey_signature,
                signed_prekey_id: pk.prekey_id as u32,
                one_time_prekey: otp.as_ref().map(|o| o.prekey.clone()),
                one_time_prekey_id: otp.as_ref().map(|o| o.prekey_id as u32),
            })
        }
        None => None,
    };

    Ok(Json(GetBundleResponse { bundle }))
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
    headers: HeaderMap,
    Json(req): Json<UploadBundleRequest>,
) -> Result<Json<UploadBundleResponse>> {
    // Authenticate the request
    let user_id = authenticate_request(&state, &headers).await?;

    // Store the prekey bundle
    prekeys::store_prekey_bundle(
        &state.db,
        user_id,
        &req.bundle.signed_prekey,
        &req.bundle.signed_prekey_signature,
        req.bundle.signed_prekey_id as i32,
    )
    .await?;

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
    headers: HeaderMap,
    Json(req): Json<UploadOneTimeRequest>,
) -> Result<Json<UploadOneTimeResponse>> {
    // Authenticate the request
    let user_id = authenticate_request(&state, &headers).await?;

    // Convert to database format
    let prekey_data: Vec<(i32, Vec<u8>)> = req
        .prekeys
        .iter()
        .map(|p| (p.id as i32, p.key.clone()))
        .collect();

    // Store in database
    let count = prekeys::store_one_time_prekeys(&state.db, user_id, &prekey_data).await?;

    Ok(Json(UploadOneTimeResponse { count }))
}

/// Authenticate a request using Bearer token.
async fn authenticate_request(state: &AppState, headers: &HeaderMap) -> Result<Uuid> {
    let auth_header = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::AuthenticationFailed("Missing authorization header".into()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::AuthenticationFailed("Invalid authorization format".into()))?;

    // Hash the token
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hasher.finalize().to_vec();

    // Look up session
    let session = sessions::get_by_token_hash(&state.db, &token_hash)
        .await
        .map_err(|_| AppError::AuthenticationFailed("Database error".into()))?
        .ok_or_else(|| AppError::AuthenticationFailed("Invalid or expired token".into()))?;

    Ok(session.user_id)
}
