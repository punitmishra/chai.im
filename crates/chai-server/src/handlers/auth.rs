//! Authentication handlers (WebAuthn).

use crate::error::{AppError, Result};
use crate::state::AppState;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct RegisterStartRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterStartResponse {
    pub challenge: String,
    pub rp_id: String,
    pub user_id: String,
}

/// Start WebAuthn registration.
pub async fn register_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterStartRequest>,
) -> Result<Json<RegisterStartResponse>> {
    // Validate username
    if req.username.is_empty() || req.username.len() > 64 {
        return Err(AppError::InvalidRequest("Invalid username".into()));
    }

    // TODO: Check if username already exists

    // Generate registration challenge
    // TODO: Implement full WebAuthn registration
    let user_id = uuid::Uuid::new_v4();

    Ok(Json(RegisterStartResponse {
        challenge: "placeholder-challenge".into(),
        rp_id: state.config.rp_id.clone(),
        user_id: user_id.to_string(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct RegisterCompleteRequest {
    pub username: String,
    pub attestation: String,
    pub identity_key: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct RegisterCompleteResponse {
    pub user_id: String,
    pub session_token: String,
}

/// Complete WebAuthn registration.
pub async fn register_complete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterCompleteRequest>,
) -> Result<Json<RegisterCompleteResponse>> {
    // TODO: Verify attestation and create user
    let user_id = uuid::Uuid::new_v4();

    Ok(Json(RegisterCompleteResponse {
        user_id: user_id.to_string(),
        session_token: "placeholder-token".into(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct LoginStartRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct LoginStartResponse {
    pub challenge: String,
    pub allowed_credentials: Vec<String>,
}

/// Start WebAuthn login.
pub async fn login_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginStartRequest>,
) -> Result<Json<LoginStartResponse>> {
    // TODO: Look up user and their credentials
    Ok(Json(LoginStartResponse {
        challenge: "placeholder-challenge".into(),
        allowed_credentials: vec![],
    }))
}

#[derive(Debug, Deserialize)]
pub struct LoginCompleteRequest {
    pub username: String,
    pub assertion: String,
}

#[derive(Debug, Serialize)]
pub struct LoginCompleteResponse {
    pub user_id: String,
    pub session_token: String,
}

/// Complete WebAuthn login.
pub async fn login_complete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginCompleteRequest>,
) -> Result<Json<LoginCompleteResponse>> {
    // TODO: Verify assertion
    let user_id = uuid::Uuid::new_v4();

    Ok(Json(LoginCompleteResponse {
        user_id: user_id.to_string(),
        session_token: "placeholder-token".into(),
    }))
}
