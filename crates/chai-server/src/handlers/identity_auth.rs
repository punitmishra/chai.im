//! Identity key challenge-response authentication handlers.
//!
//! This provides passwordless authentication using Ed25519 signatures.
//! Users prove possession of their identity key by signing a challenge nonce.

use crate::db::{sessions, users};
use crate::error::{AppError, Result};
use crate::state::AppState;
use axum::{extract::State, Json};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use time::{Duration, OffsetDateTime};
use tokio::sync::RwLock;
use uuid::Uuid;

/// In-memory challenge store (for production, use Redis or database)
#[derive(Default)]
pub struct ChallengeStore {
    challenges: RwLock<HashMap<String, StoredChallenge>>,
}

struct StoredChallenge {
    challenge: [u8; 32],
    expires_at: OffsetDateTime,
}

impl ChallengeStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn store(&self, username: &str, challenge: [u8; 32], expires_at: OffsetDateTime) {
        let mut challenges = self.challenges.write().await;
        challenges.insert(
            username.to_lowercase(),
            StoredChallenge {
                challenge,
                expires_at,
            },
        );
    }

    pub async fn verify_and_consume(&self, username: &str, challenge: &[u8]) -> bool {
        let mut challenges = self.challenges.write().await;
        let key = username.to_lowercase();

        if let Some(stored) = challenges.get(&key) {
            // Check expiration
            if stored.expires_at <= OffsetDateTime::now_utc() {
                challenges.remove(&key);
                return false;
            }

            // Check challenge matches
            if stored.challenge.as_slice() == challenge {
                challenges.remove(&key);
                return true;
            }
        }

        false
    }

    /// Clean up expired challenges (call periodically)
    #[allow(dead_code)]
    pub async fn cleanup(&self) {
        let mut challenges = self.challenges.write().await;
        let now = OffsetDateTime::now_utc();
        challenges.retain(|_, v| v.expires_at > now);
    }
}

// Request/Response types

#[derive(Debug, Deserialize)]
pub struct IdentityRegisterRequest {
    pub username: String,
    pub identity_key: Vec<u8>, // 32-byte Ed25519 public key
}

#[derive(Debug, Serialize)]
pub struct IdentityRegisterResponse {
    pub user_id: String,
    pub session_token: String,
}

/// Register with identity key (from mnemonic derivation).
pub async fn identity_register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<IdentityRegisterRequest>,
) -> Result<Json<IdentityRegisterResponse>> {
    // Validate username
    if req.username.is_empty() || req.username.len() > 64 {
        return Err(AppError::InvalidRequest("Invalid username".into()));
    }

    // Validate username format (alphanumeric + underscore)
    if !req
        .username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(AppError::InvalidRequest(
            "Username can only contain letters, numbers, and underscores".into(),
        ));
    }

    // Validate identity key format
    if req.identity_key.len() != 32 {
        return Err(AppError::InvalidRequest(
            "Identity key must be 32 bytes".into(),
        ));
    }

    // Verify the identity key is a valid Ed25519 public key
    let key_bytes: [u8; 32] = req
        .identity_key
        .clone()
        .try_into()
        .map_err(|_| AppError::InvalidRequest("Invalid identity key format".into()))?;

    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|_| AppError::InvalidRequest("Invalid Ed25519 public key".into()))?;

    // Check if username already exists
    if users::username_exists(&state.db, &req.username).await? {
        return Err(AppError::UserAlreadyExists);
    }

    // Create the user with identity auth
    let user = users::create_user(&state.db, &req.username, &req.identity_key).await?;

    // Generate session token
    let session_token = generate_session_token();
    let token_hash = hash_token(&session_token);
    let device_id = Uuid::new_v4();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sessions::create_session(&state.db, user.id, device_id, &token_hash, expires_at).await?;

    Ok(Json(IdentityRegisterResponse {
        user_id: user.id.to_string(),
        session_token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ChallengeRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct ChallengeResponse {
    pub challenge: Vec<u8>, // 32-byte random nonce
    pub expires_at: i64,    // Unix timestamp
}

/// Request a login challenge.
pub async fn request_challenge(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChallengeRequest>,
) -> Result<Json<ChallengeResponse>> {
    // Verify user exists (don't reveal if they don't for security)
    let _user = users::get_by_username(&state.db, &req.username)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Generate random challenge
    let mut challenge = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut challenge);

    let expires_at = OffsetDateTime::now_utc() + Duration::minutes(5);

    // Store challenge
    state
        .challenge_store
        .store(&req.username, challenge, expires_at)
        .await;

    Ok(Json(ChallengeResponse {
        challenge: challenge.to_vec(),
        expires_at: expires_at.unix_timestamp(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct VerifySignatureRequest {
    pub username: String,
    pub challenge: Vec<u8>, // Original challenge
    pub signature: Vec<u8>, // Ed25519 signature (64 bytes)
}

#[derive(Debug, Serialize)]
pub struct VerifySignatureResponse {
    pub user_id: String,
    pub session_token: String,
}

/// Verify signature and create session.
pub async fn verify_signature(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifySignatureRequest>,
) -> Result<Json<VerifySignatureResponse>> {
    // Validate signature length
    if req.signature.len() != 64 {
        return Err(AppError::AuthenticationFailed(
            "Invalid signature length".into(),
        ));
    }

    // Get user and their identity key
    let user = users::get_by_username(&state.db, &req.username)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Verify challenge exists and is not expired/used
    let valid = state
        .challenge_store
        .verify_and_consume(&req.username, &req.challenge)
        .await;

    if !valid {
        return Err(AppError::AuthenticationFailed(
            "Invalid or expired challenge".into(),
        ));
    }

    // Parse identity key
    let identity_bytes: [u8; 32] = user
        .identity_key
        .try_into()
        .map_err(|_| AppError::Internal("Invalid stored identity key".into()))?;

    let verifying_key = VerifyingKey::from_bytes(&identity_bytes)
        .map_err(|_| AppError::Internal("Failed to parse identity key".into()))?;

    // Parse signature
    let sig_bytes: [u8; 64] = req
        .signature
        .try_into()
        .map_err(|_| AppError::AuthenticationFailed("Invalid signature format".into()))?;

    let signature = Signature::from_bytes(&sig_bytes);

    // Verify signature
    verifying_key
        .verify(&req.challenge, &signature)
        .map_err(|_| AppError::AuthenticationFailed("Invalid signature".into()))?;

    // Create session
    let session_token = generate_session_token();
    let token_hash = hash_token(&session_token);
    let device_id = Uuid::new_v4();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);

    sessions::create_session(&state.db, user.id, device_id, &token_hash, expires_at).await?;

    Ok(Json(VerifySignatureResponse {
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
