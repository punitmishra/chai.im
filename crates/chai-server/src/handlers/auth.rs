//! Authentication handlers (WebAuthn).

use crate::db::{credentials, sessions, users};
use crate::error::{AppError, Result};
use crate::state::AppState;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use time::{Duration, OffsetDateTime};
use uuid::Uuid;
use webauthn_rs::prelude::*;

#[derive(Debug, Deserialize)]
pub struct RegisterStartRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterStartResponse {
    pub options: CreationChallengeResponse,
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

    // Check if username already exists
    if users::username_exists(&state.db, &req.username).await? {
        return Err(AppError::UserAlreadyExists);
    }

    // Generate a user ID for the new user
    let user_id = Uuid::new_v4();

    // Start WebAuthn registration
    let (ccr, reg_state) = state
        .webauthn
        .start_passkey_registration(
            user_id,
            &req.username,
            &req.username,
            None, // No existing credentials
        )
        .map_err(|e| AppError::Internal(format!("WebAuthn error: {}", e)))?;

    // Store registration state (keyed by username)
    {
        let mut reg_states = state.reg_states.write().await;
        reg_states.insert(req.username.clone(), reg_state);
    }

    Ok(Json(RegisterStartResponse {
        options: ccr,
        user_id: user_id.to_string(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct RegisterCompleteRequest {
    pub username: String,
    pub credential: RegisterPublicKeyCredential,
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
    // Retrieve and remove registration state
    let reg_state = {
        let mut reg_states = state.reg_states.write().await;
        reg_states
            .remove(&req.username)
            .ok_or_else(|| AppError::InvalidRequest("No pending registration".into()))?
    };

    // Verify the attestation
    let passkey = state
        .webauthn
        .finish_passkey_registration(&req.credential, &reg_state)
        .map_err(|e| AppError::AuthenticationFailed(format!("Attestation failed: {}", e)))?;

    // Create the user
    let user = users::create_user(&state.db, &req.username, &req.identity_key).await?;

    // Store the WebAuthn credential
    credentials::create_credential(
        &state.db,
        user.id,
        passkey.cred_id().as_ref(),
        &serde_json::to_vec(&passkey).unwrap_or_default(),
        0,
    )
    .await?;

    // Generate session token
    let session_token = generate_session_token();
    let token_hash = hash_token(&session_token);
    let device_id = Uuid::new_v4();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sessions::create_session(&state.db, user.id, device_id, &token_hash, expires_at).await?;

    Ok(Json(RegisterCompleteResponse {
        user_id: user.id.to_string(),
        session_token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct LoginStartRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct LoginStartResponse {
    pub options: RequestChallengeResponse,
}

/// Start WebAuthn login.
pub async fn login_start(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginStartRequest>,
) -> Result<Json<LoginStartResponse>> {
    // Look up user
    let user = users::get_by_username(&state.db, &req.username)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Get user's credentials
    let creds = credentials::get_by_user_id(&state.db, user.id).await?;
    if creds.is_empty() {
        return Err(AppError::AuthenticationFailed("No credentials found".into()));
    }

    // Deserialize passkeys
    let passkeys: Vec<Passkey> = creds
        .iter()
        .filter_map(|c| serde_json::from_slice(&c.public_key).ok())
        .collect();

    if passkeys.is_empty() {
        return Err(AppError::Internal("Failed to deserialize credentials".into()));
    }

    // Start WebAuthn authentication
    let (rcr, auth_state) = state
        .webauthn
        .start_passkey_authentication(&passkeys)
        .map_err(|e| AppError::Internal(format!("WebAuthn error: {}", e)))?;

    // Store authentication state
    {
        let mut auth_states = state.auth_states.write().await;
        auth_states.insert(req.username.clone(), auth_state);
    }

    Ok(Json(LoginStartResponse { options: rcr }))
}

#[derive(Debug, Deserialize)]
pub struct LoginCompleteRequest {
    pub username: String,
    pub credential: PublicKeyCredential,
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
    // Retrieve and remove authentication state
    let auth_state = {
        let mut auth_states = state.auth_states.write().await;
        auth_states
            .remove(&req.username)
            .ok_or_else(|| AppError::InvalidRequest("No pending authentication".into()))?
    };

    // Look up user
    let user = users::get_by_username(&state.db, &req.username)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Verify the assertion
    let auth_result = state
        .webauthn
        .finish_passkey_authentication(&req.credential, &auth_state)
        .map_err(|e| AppError::AuthenticationFailed(format!("Assertion failed: {}", e)))?;

    // Update credential counter if needed
    if auth_result.needs_update() {
        credentials::update_counter(
            &state.db,
            auth_result.cred_id().as_ref(),
            auth_result.counter(),
        )
        .await?;
    }

    // Generate session token
    let session_token = generate_session_token();
    let token_hash = hash_token(&session_token);
    let device_id = Uuid::new_v4();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sessions::create_session(&state.db, user.id, device_id, &token_hash, expires_at).await?;

    Ok(Json(LoginCompleteResponse {
        user_id: user.id.to_string(),
        session_token,
    }))
}

/// Generate a random session token.
fn generate_session_token() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::thread_rng().gen();
    base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, bytes)
}

/// Hash a session token for storage.
fn hash_token(token: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hasher.finalize().to_vec()
}
