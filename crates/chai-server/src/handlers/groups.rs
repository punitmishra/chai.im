//! Group chat handlers.

use crate::db::groups;
use crate::error::{AppError, Result};
use crate::handlers::users::authenticate_request;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// Request/Response types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub is_public: bool,
}

#[derive(Debug, Serialize)]
pub struct GroupResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub avatar_url: Option<String>,
    pub owner_id: String,
    pub is_public: bool,
    pub member_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct GroupListResponse {
    pub groups: Vec<GroupResponse>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGroupRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MemberResponse {
    pub user_id: String,
    pub role: String,
    pub joined_at: String,
}

#[derive(Debug, Serialize)]
pub struct MemberListResponse {
    pub members: Vec<MemberResponse>,
}

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: String,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "member".to_string()
}

#[derive(Debug, Deserialize)]
pub struct CreateInviteRequest {
    pub max_uses: Option<i32>,
    pub expires_in_hours: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct InviteResponse {
    pub invite_code: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JoinByCodeRequest {
    pub code: String,
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

// ============================================================================
// Handlers
// ============================================================================

/// Create a new group.
pub async fn create_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateGroupRequest>,
) -> Result<Json<GroupResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    // Validate name
    let name = req.name.trim();
    if name.is_empty() || name.len() > 128 {
        return Err(AppError::InvalidRequest("Invalid group name".into()));
    }

    // Create group
    let group = groups::create_group(
        &state.db,
        name,
        req.description.as_deref(),
        auth_user.user_id,
        req.is_public,
    )
    .await?;

    Ok(Json(GroupResponse {
        id: group.id.to_string(),
        name: group.name,
        description: group.description,
        avatar_url: group.avatar_url,
        owner_id: group.owner_id.to_string(),
        is_public: group.is_public,
        member_count: 1,
        created_at: group.created_at.to_string(),
    }))
}

/// Get group details.
pub async fn get_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
) -> Result<Json<GroupResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    // Check if user is a member
    let member = groups::get_member(&state.db, group_id, auth_user.user_id).await?;

    let group = groups::get_group(&state.db, group_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Must be a member or the group must be public
    if member.is_none() && !group.is_public {
        return Err(AppError::Forbidden);
    }

    let member_count = groups::count_members(&state.db, group_id).await?;

    Ok(Json(GroupResponse {
        id: group.id.to_string(),
        name: group.name,
        description: group.description,
        avatar_url: group.avatar_url,
        owner_id: group.owner_id.to_string(),
        is_public: group.is_public,
        member_count,
        created_at: group.created_at.to_string(),
    }))
}

/// List groups the user is a member of.
pub async fn list_my_groups(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<GroupListResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let user_groups = groups::list_user_groups(&state.db, auth_user.user_id).await?;

    let mut responses = Vec::with_capacity(user_groups.len());
    for group in user_groups {
        let member_count = groups::count_members(&state.db, group.id).await?;
        responses.push(GroupResponse {
            id: group.id.to_string(),
            name: group.name,
            description: group.description,
            avatar_url: group.avatar_url,
            owner_id: group.owner_id.to_string(),
            is_public: group.is_public,
            member_count,
            created_at: group.created_at.to_string(),
        });
    }

    Ok(Json(GroupListResponse { groups: responses }))
}

/// Update group details.
pub async fn update_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
    Json(req): Json<UpdateGroupRequest>,
) -> Result<Json<GroupResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    // Check if user is admin
    let member = groups::get_member(&state.db, group_id, auth_user.user_id)
        .await?
        .ok_or(AppError::Forbidden)?;

    if member.role != "admin" {
        return Err(AppError::Forbidden);
    }

    let group = groups::update_group(
        &state.db,
        group_id,
        req.name.as_deref(),
        req.description.as_deref(),
        req.avatar_url.as_deref(),
    )
    .await?;

    let member_count = groups::count_members(&state.db, group_id).await?;

    Ok(Json(GroupResponse {
        id: group.id.to_string(),
        name: group.name,
        description: group.description,
        avatar_url: group.avatar_url,
        owner_id: group.owner_id.to_string(),
        is_public: group.is_public,
        member_count,
        created_at: group.created_at.to_string(),
    }))
}

/// Delete a group.
pub async fn delete_group(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
) -> Result<()> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    // Must be owner
    let group = groups::get_group(&state.db, group_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if group.owner_id != auth_user.user_id {
        return Err(AppError::Forbidden);
    }

    groups::delete_group(&state.db, group_id).await?;

    Ok(())
}

/// List group members.
pub async fn list_members(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
) -> Result<Json<MemberListResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    // Must be a member
    groups::get_member(&state.db, group_id, auth_user.user_id)
        .await?
        .ok_or(AppError::Forbidden)?;

    let members = groups::list_members(&state.db, group_id).await?;

    let responses: Vec<MemberResponse> = members
        .into_iter()
        .map(|m| MemberResponse {
            user_id: m.user_id.to_string(),
            role: m.role,
            joined_at: m.joined_at.to_string(),
        })
        .collect();

    Ok(Json(MemberListResponse { members: responses }))
}

/// Add a member to a group.
pub async fn add_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
    Json(req): Json<AddMemberRequest>,
) -> Result<Json<MemberResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    let user_id = Uuid::parse_str(&req.user_id)
        .map_err(|_| AppError::InvalidRequest("Invalid user ID".into()))?;

    // Must be admin
    let member = groups::get_member(&state.db, group_id, auth_user.user_id)
        .await?
        .ok_or(AppError::Forbidden)?;

    if member.role != "admin" {
        return Err(AppError::Forbidden);
    }

    // Check member limit
    let group = groups::get_group(&state.db, group_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let count = groups::count_members(&state.db, group_id).await?;
    if count >= group.max_members as i64 {
        return Err(AppError::InvalidRequest("Group is full".into()));
    }

    let new_member = groups::add_member(&state.db, group_id, user_id, &req.role).await?;

    Ok(Json(MemberResponse {
        user_id: new_member.user_id.to_string(),
        role: new_member.role,
        joined_at: new_member.joined_at.to_string(),
    }))
}

/// Remove a member from a group.
pub async fn remove_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((group_id, user_id)): Path<(String, String)>,
) -> Result<()> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    let user_id = Uuid::parse_str(&user_id)
        .map_err(|_| AppError::InvalidRequest("Invalid user ID".into()))?;

    // Can remove self or must be admin
    if auth_user.user_id != user_id {
        let member = groups::get_member(&state.db, group_id, auth_user.user_id)
            .await?
            .ok_or(AppError::Forbidden)?;

        if member.role != "admin" {
            return Err(AppError::Forbidden);
        }
    }

    // Can't remove the owner
    let group = groups::get_group(&state.db, group_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if group.owner_id == user_id {
        return Err(AppError::InvalidRequest("Cannot remove group owner".into()));
    }

    groups::remove_member(&state.db, group_id, user_id).await?;

    Ok(())
}

/// Create an invite link.
pub async fn create_invite(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(group_id): Path<String>,
    Json(req): Json<CreateInviteRequest>,
) -> Result<Json<InviteResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    let group_id = Uuid::parse_str(&group_id)
        .map_err(|_| AppError::InvalidRequest("Invalid group ID".into()))?;

    // Must be a member
    groups::get_member(&state.db, group_id, auth_user.user_id)
        .await?
        .ok_or(AppError::Forbidden)?;

    // Generate invite code
    let invite_code = generate_invite_code();

    // Calculate expiration
    let expires_at = req
        .expires_in_hours
        .map(|hours| time::OffsetDateTime::now_utc() + time::Duration::hours(hours));

    let invite = groups::create_invite_link(
        &state.db,
        group_id,
        auth_user.user_id,
        &invite_code,
        req.max_uses,
        expires_at,
    )
    .await?;

    Ok(Json(InviteResponse {
        invite_code: invite.invite_code.unwrap_or_default(),
        expires_at: invite.expires_at.map(|t| t.to_string()),
    }))
}

/// Join a group using an invite code.
pub async fn join_by_code(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<JoinByCodeRequest>,
) -> Result<Json<GroupResponse>> {
    let auth_user = authenticate_request(&state, &headers).await?;

    // Find the invite
    let invite = groups::get_invite_by_code(&state.db, &req.code)
        .await?
        .ok_or(AppError::InvalidRequest("Invalid or expired invite".into()))?;

    // Check if already a member
    if groups::get_member(&state.db, invite.group_id, auth_user.user_id)
        .await?
        .is_some()
    {
        return Err(AppError::InvalidRequest("Already a member".into()));
    }

    // Check member limit
    let group = groups::get_group(&state.db, invite.group_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let count = groups::count_members(&state.db, invite.group_id).await?;
    if count >= group.max_members as i64 {
        return Err(AppError::InvalidRequest("Group is full".into()));
    }

    // Join the group
    groups::add_member(&state.db, invite.group_id, auth_user.user_id, "member").await?;

    // Use the invite
    groups::use_invite(&state.db, invite.id).await?;

    let member_count = count + 1;

    Ok(Json(GroupResponse {
        id: group.id.to_string(),
        name: group.name,
        description: group.description,
        avatar_url: group.avatar_url,
        owner_id: group.owner_id.to_string(),
        is_public: group.is_public,
        member_count,
        created_at: group.created_at.to_string(),
    }))
}

/// Search public groups.
pub async fn search_groups(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> Result<Json<GroupListResponse>> {
    let _auth_user = authenticate_request(&state, &headers).await?;

    let limit = query.limit.clamp(1, 50);
    let results = groups::search_public_groups(&state.db, &query.q, limit).await?;

    let mut responses = Vec::with_capacity(results.len());
    for group in results {
        let member_count = groups::count_members(&state.db, group.id).await?;
        responses.push(GroupResponse {
            id: group.id.to_string(),
            name: group.name,
            description: group.description,
            avatar_url: group.avatar_url,
            owner_id: group.owner_id.to_string(),
            is_public: group.is_public,
            member_count,
            created_at: group.created_at.to_string(),
        });
    }

    Ok(Json(GroupListResponse { groups: responses }))
}

/// Generate a random invite code.
fn generate_invite_code() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}
