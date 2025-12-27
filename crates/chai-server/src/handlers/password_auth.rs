//! Password-based authentication handlers.
//!
//! This provides an alternative to WebAuthn for users without hardware keys.
//! Uses Argon2id for password hashing.

use crate::db::{sessions, users};
use crate::error::{AppError, Result};
use crate::state::AppState;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct PasswordRegisterRequest {
    pub username: String,
    pub password: String,
    pub identity_key: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct PasswordRegisterResponse {
    pub user_id: String,
    pub session_token: String,
}

/// Register with username and password.
pub async fn password_register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PasswordRegisterRequest>,
) -> Result<Json<PasswordRegisterResponse>> {
    // Validate username
    if req.username.is_empty() || req.username.len() > 64 {
        return Err(AppError::InvalidRequest("Invalid username".into()));
    }

    // Validate password strength
    if req.password.len() < 8 {
        return Err(AppError::InvalidRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    // Check if username already exists
    if users::username_exists(&state.db, &req.username).await? {
        return Err(AppError::UserAlreadyExists);
    }

    // Hash password with Argon2id
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?
        .to_string();

    // Create the user with password auth
    let user = users::create_user_with_password(
        &state.db,
        &req.username,
        &req.identity_key,
        password_hash.as_bytes(),
    )
    .await?;

    // Generate session token
    let session_token = generate_session_token();
    let token_hash = hash_token(&session_token);
    let device_id = Uuid::new_v4();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sessions::create_session(&state.db, user.id, device_id, &token_hash, expires_at).await?;

    Ok(Json(PasswordRegisterResponse {
        user_id: user.id.to_string(),
        session_token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct PasswordLoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct PasswordLoginResponse {
    pub user_id: String,
    pub session_token: String,
}

/// Login with username and password.
pub async fn password_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PasswordLoginRequest>,
) -> Result<Json<PasswordLoginResponse>> {
    // Look up user
    let user = users::get_by_username_with_password(&state.db, &req.username)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Verify user has password auth enabled
    let password_hash = user.password_hash.ok_or(AppError::AuthenticationFailed(
        "User has no password set".into(),
    ))?;

    // Verify password
    let parsed_hash = PasswordHash::new(std::str::from_utf8(&password_hash).unwrap_or(""))
        .map_err(|_| AppError::AuthenticationFailed("Invalid stored password".into()))?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::AuthenticationFailed("Invalid password".into()))?;

    // Generate session token
    let session_token = generate_session_token();
    let token_hash = hash_token(&session_token);
    let device_id = Uuid::new_v4();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sessions::create_session(&state.db, user.id, device_id, &token_hash, expires_at).await?;

    Ok(Json(PasswordLoginResponse {
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
