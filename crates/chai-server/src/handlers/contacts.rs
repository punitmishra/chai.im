//! Contact management handlers.
//!
//! Handles peer identity exchange - adding, verifying, and managing contacts.

use crate::db::{contacts, users};
use crate::error::{AppError, Result};
use crate::handlers::users::authenticate_request;
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Request to add a contact by identity key.
#[derive(Debug, Deserialize)]
pub struct AddContactByKeyRequest {
    /// The contact's identity key (32 bytes, base64 encoded).
    pub identity_key: String,
    /// Optional alias for the contact.
    pub alias: Option<String>,
}

/// Request to add a contact by user ID.
#[derive(Debug, Deserialize)]
pub struct AddContactByIdRequest {
    /// The contact's user ID.
    pub user_id: String,
    /// Optional alias for the contact.
    pub alias: Option<String>,
}

/// Contact response.
#[derive(Debug, Serialize)]
pub struct ContactResponse {
    pub id: String,
    pub user_id: String,
    pub username: String,
    pub alias: Option<String>,
    pub verified: bool,
    pub created_at: i64,
}

/// Add a contact by their identity key.
pub async fn add_by_identity_key(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<AddContactByKeyRequest>,
) -> Result<Json<ContactResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;
    // Decode identity key
    let identity_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &req.identity_key,
    )
    .map_err(|_| AppError::InvalidRequest("Invalid identity key encoding".into()))?;

    if identity_bytes.len() != 32 {
        return Err(AppError::InvalidRequest(
            "Identity key must be 32 bytes".into(),
        ));
    }

    // Find user by identity key
    let contact_user = find_user_by_identity_key(&state, &identity_bytes).await?;

    // Can't add yourself
    if contact_user.id == auth_user.user_id {
        return Err(AppError::InvalidRequest(
            "Cannot add yourself as a contact".into(),
        ));
    }

    // Add contact
    let contact = contacts::add_contact(
        &state.db,
        auth_user.user_id,
        contact_user.id,
        req.alias.as_deref(),
    )
    .await?;

    Ok(Json(ContactResponse {
        id: contact.id.to_string(),
        user_id: contact_user.id.to_string(),
        username: contact_user.username,
        alias: contact.alias,
        verified: contact.verified,
        created_at: contact.created_at.unix_timestamp(),
    }))
}

/// Add a contact by their user ID.
pub async fn add_by_user_id(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<AddContactByIdRequest>,
) -> Result<Json<ContactResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;
    let contact_user_id: Uuid = req
        .user_id
        .parse()
        .map_err(|_| AppError::InvalidRequest("Invalid user ID".into()))?;

    // Can't add yourself
    if contact_user_id == auth_user.user_id {
        return Err(AppError::InvalidRequest(
            "Cannot add yourself as a contact".into(),
        ));
    }

    // Verify user exists
    let contact_user = users::get_by_id(&state.db, contact_user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Add contact
    let contact = contacts::add_contact(
        &state.db,
        auth_user.user_id,
        contact_user.id,
        req.alias.as_deref(),
    )
    .await?;

    Ok(Json(ContactResponse {
        id: contact.id.to_string(),
        user_id: contact_user.id.to_string(),
        username: contact_user.username,
        alias: contact.alias,
        verified: contact.verified,
        created_at: contact.created_at.unix_timestamp(),
    }))
}

/// List all contacts.
pub async fn list_contacts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<ContactResponse>>> {
    let auth_user = authenticate_request(&state, &headers).await?;
    let contacts_list = contacts::get_contacts(&state.db, auth_user.user_id).await?;

    let mut responses = Vec::with_capacity(contacts_list.len());
    for contact in contacts_list {
        if let Some(user) = users::get_by_id(&state.db, contact.contact_user_id).await? {
            responses.push(ContactResponse {
                id: contact.id.to_string(),
                user_id: user.id.to_string(),
                username: user.username,
                alias: contact.alias,
                verified: contact.verified,
                created_at: contact.created_at.unix_timestamp(),
            });
        }
    }

    Ok(Json(responses))
}

/// Mark a contact as verified.
pub async fn verify_contact(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(contact_user_id): Path<Uuid>,
) -> Result<Json<ContactResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;
    let contact = contacts::verify_contact(&state.db, auth_user.user_id, contact_user_id)
        .await?
        .ok_or(AppError::NotFound("Contact not found".into()))?;

    let user = users::get_by_id(&state.db, contact.contact_user_id)
        .await?
        .ok_or(AppError::UserNotFound)?;

    Ok(Json(ContactResponse {
        id: contact.id.to_string(),
        user_id: user.id.to_string(),
        username: user.username,
        alias: contact.alias,
        verified: contact.verified,
        created_at: contact.created_at.unix_timestamp(),
    }))
}

/// Remove a contact.
pub async fn remove_contact(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(contact_user_id): Path<Uuid>,
) -> Result<()> {
    let auth_user = authenticate_request(&state, &headers).await?;
    let removed = contacts::remove_contact(&state.db, auth_user.user_id, contact_user_id).await?;

    if !removed {
        return Err(AppError::NotFound("Contact not found".into()));
    }

    Ok(())
}

/// Helper to find user by identity key.
async fn find_user_by_identity_key(state: &AppState, identity_key: &[u8]) -> Result<users::User> {
    // Query user by identity key
    let user: Option<users::User> = sqlx::query_as::<_, users::User>(
        r#"
        SELECT id, username, identity_key, created_at, updated_at
        FROM users
        WHERE identity_key = $1
        "#,
    )
    .bind(identity_key)
    .fetch_optional(&state.db)
    .await?;

    user.ok_or(AppError::UserNotFound)
}
