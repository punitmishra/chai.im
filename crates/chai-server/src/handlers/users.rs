//! User handlers (search, profile).

use crate::db::{sessions, users};
use crate::error::{AppError, Result};
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap},
    Json,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

/// Authenticated user extracted from bearer token.
pub struct AuthUser {
    pub user_id: Uuid,
}

/// Extract authenticated user from Authorization header.
pub async fn authenticate_request(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<AuthUser> {
    // Get Authorization header
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    // Parse Bearer token
    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?;

    // Hash the token and look up session
    let token_hash = hash_token(token);
    let session = sessions::get_by_token_hash(&state.db, &token_hash)
        .await?
        .ok_or(AppError::Unauthorized)?;

    Ok(AuthUser {
        user_id: session.user_id,
    })
}

/// Hash a session token for lookup.
fn hash_token(token: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hasher.finalize().to_vec()
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Debug, Serialize)]
pub struct UserResult {
    pub id: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub users: Vec<UserResult>,
}

/// Search for users by username.
/// Requires authentication.
pub async fn search_users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    // Authenticate the request
    let auth_user = authenticate_request(&state, &headers).await?;

    // Validate query
    let search_query = query.q.trim();
    if search_query.is_empty() {
        return Ok(Json(SearchResponse { users: vec![] }));
    }

    // Limit to reasonable range
    let limit = query.limit.clamp(1, 50);

    // Search for users
    let results = users::search_by_username(&state.db, search_query, auth_user.user_id, limit)
        .await?;

    let users = results
        .into_iter()
        .map(|u| UserResult {
            id: u.id.to_string(),
            username: u.username,
        })
        .collect();

    Ok(Json(SearchResponse { users }))
}

#[derive(Debug, Serialize)]
pub struct UserProfileResponse {
    pub id: String,
    pub username: String,
}

/// Get a user's public profile by ID.
/// Requires authentication.
pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Path(user_id): axum::extract::Path<String>,
) -> Result<Json<UserProfileResponse>> {
    // Authenticate the request
    let _auth_user = authenticate_request(&state, &headers).await?;

    // Parse user ID
    let user_id = Uuid::parse_str(&user_id)
        .map_err(|_| AppError::InvalidRequest("Invalid user ID".into()))?;

    // Get user
    let user = users::get_by_id(&state.db, user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    Ok(Json(UserProfileResponse {
        id: user.id.to_string(),
        username: user.username,
    }))
}
