//! Group database operations.

use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct Group {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub avatar_url: Option<String>,
    pub owner_id: Uuid,
    pub is_public: bool,
    pub max_members: i32,
    pub created_at: time::OffsetDateTime,
    pub updated_at: time::OffsetDateTime,
}

#[derive(Debug, Clone, FromRow)]
pub struct GroupMember {
    pub id: Uuid,
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub joined_at: time::OffsetDateTime,
    pub muted_until: Option<time::OffsetDateTime>,
}

#[derive(Debug, Clone, FromRow)]
pub struct GroupInvite {
    pub id: Uuid,
    pub group_id: Uuid,
    pub inviter_id: Uuid,
    pub invitee_id: Option<Uuid>,
    pub invite_code: Option<String>,
    pub max_uses: Option<i32>,
    pub use_count: i32,
    pub expires_at: Option<time::OffsetDateTime>,
    pub created_at: time::OffsetDateTime,
}

#[derive(Debug, Clone, FromRow)]
pub struct GroupMessage {
    pub id: Uuid,
    pub group_id: Uuid,
    pub sender_id: Uuid,
    pub ciphertext: Vec<u8>,
    pub sender_key_id: i32,
    pub message_type: i16,
    pub reply_to_id: Option<Uuid>,
    pub created_at: time::OffsetDateTime,
}

#[derive(Debug, Clone, FromRow)]
pub struct GroupSenderKey {
    pub id: Uuid,
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub sender_key: Vec<u8>,
    pub key_id: i32,
    pub created_at: time::OffsetDateTime,
}

// ============================================================================
// Group CRUD
// ============================================================================

/// Create a new group.
pub async fn create_group(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    owner_id: Uuid,
    is_public: bool,
) -> sqlx::Result<Group> {
    let group = sqlx::query_as::<_, Group>(
        r#"
        INSERT INTO groups (name, description, owner_id, is_public)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(owner_id)
    .bind(is_public)
    .fetch_one(pool)
    .await?;

    // Add owner as admin member
    sqlx::query(
        r#"
        INSERT INTO group_members (group_id, user_id, role)
        VALUES ($1, $2, 'admin')
        "#,
    )
    .bind(group.id)
    .bind(owner_id)
    .execute(pool)
    .await?;

    Ok(group)
}

/// Get a group by ID.
pub async fn get_group(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<Group>> {
    sqlx::query_as::<_, Group>(
        r#"
        SELECT * FROM groups WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Update group details.
pub async fn update_group(
    pool: &PgPool,
    id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    avatar_url: Option<&str>,
) -> sqlx::Result<Group> {
    sqlx::query_as::<_, Group>(
        r#"
        UPDATE groups
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            avatar_url = COALESCE($4, avatar_url)
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(avatar_url)
    .fetch_one(pool)
    .await
}

/// Delete a group.
pub async fn delete_group(pool: &PgPool, id: Uuid) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM groups WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// List groups a user is a member of.
pub async fn list_user_groups(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Vec<Group>> {
    sqlx::query_as::<_, Group>(
        r#"
        SELECT g.* FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = $1
        ORDER BY g.updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Search public groups.
pub async fn search_public_groups(
    pool: &PgPool,
    query: &str,
    limit: i64,
) -> sqlx::Result<Vec<Group>> {
    sqlx::query_as::<_, Group>(
        r#"
        SELECT * FROM groups
        WHERE is_public = true AND name ILIKE $1
        ORDER BY name
        LIMIT $2
        "#,
    )
    .bind(format!("%{}%", query))
    .bind(limit)
    .fetch_all(pool)
    .await
}

// ============================================================================
// Group Members
// ============================================================================

/// Add a member to a group.
pub async fn add_member(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> sqlx::Result<GroupMember> {
    sqlx::query_as::<_, GroupMember>(
        r#"
        INSERT INTO group_members (group_id, user_id, role)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .bind(role)
    .fetch_one(pool)
    .await
}

/// Remove a member from a group.
pub async fn remove_member(pool: &PgPool, group_id: Uuid, user_id: Uuid) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Get a member's details.
pub async fn get_member(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<GroupMember>> {
    sqlx::query_as::<_, GroupMember>(
        r#"
        SELECT * FROM group_members
        WHERE group_id = $1 AND user_id = $2
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// List all members of a group.
pub async fn list_members(pool: &PgPool, group_id: Uuid) -> sqlx::Result<Vec<GroupMember>> {
    sqlx::query_as::<_, GroupMember>(
        r#"
        SELECT * FROM group_members
        WHERE group_id = $1
        ORDER BY joined_at
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
}

/// Update member role.
pub async fn update_member_role(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> sqlx::Result<GroupMember> {
    sqlx::query_as::<_, GroupMember>(
        r#"
        UPDATE group_members
        SET role = $3
        WHERE group_id = $1 AND user_id = $2
        RETURNING *
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .bind(role)
    .fetch_one(pool)
    .await
}

/// Count members in a group.
pub async fn count_members(pool: &PgPool, group_id: Uuid) -> sqlx::Result<i64> {
    let row: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) FROM group_members WHERE group_id = $1
        "#,
    )
    .bind(group_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

// ============================================================================
// Sender Keys
// ============================================================================

/// Store a sender key.
pub async fn store_sender_key(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
    sender_key: &[u8],
    key_id: i32,
) -> sqlx::Result<GroupSenderKey> {
    sqlx::query_as::<_, GroupSenderKey>(
        r#"
        INSERT INTO group_sender_keys (group_id, user_id, sender_key, key_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (group_id, user_id, key_id) DO UPDATE
        SET sender_key = EXCLUDED.sender_key
        RETURNING *
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .bind(sender_key)
    .bind(key_id)
    .fetch_one(pool)
    .await
}

/// Get sender key for a user in a group.
pub async fn get_sender_key(
    pool: &PgPool,
    group_id: Uuid,
    user_id: Uuid,
    key_id: i32,
) -> sqlx::Result<Option<GroupSenderKey>> {
    sqlx::query_as::<_, GroupSenderKey>(
        r#"
        SELECT * FROM group_sender_keys
        WHERE group_id = $1 AND user_id = $2 AND key_id = $3
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .bind(key_id)
    .fetch_optional(pool)
    .await
}

/// Get all sender keys for a group.
pub async fn get_group_sender_keys(
    pool: &PgPool,
    group_id: Uuid,
) -> sqlx::Result<Vec<GroupSenderKey>> {
    sqlx::query_as::<_, GroupSenderKey>(
        r#"
        SELECT * FROM group_sender_keys
        WHERE group_id = $1
        ORDER BY user_id, key_id DESC
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
}

// ============================================================================
// Invites
// ============================================================================

/// Create an invite link.
pub async fn create_invite_link(
    pool: &PgPool,
    group_id: Uuid,
    inviter_id: Uuid,
    invite_code: &str,
    max_uses: Option<i32>,
    expires_at: Option<time::OffsetDateTime>,
) -> sqlx::Result<GroupInvite> {
    sqlx::query_as::<_, GroupInvite>(
        r#"
        INSERT INTO group_invites (group_id, inviter_id, invite_code, max_uses, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(group_id)
    .bind(inviter_id)
    .bind(invite_code)
    .bind(max_uses)
    .bind(expires_at)
    .fetch_one(pool)
    .await
}

/// Create a direct invite.
pub async fn create_direct_invite(
    pool: &PgPool,
    group_id: Uuid,
    inviter_id: Uuid,
    invitee_id: Uuid,
) -> sqlx::Result<GroupInvite> {
    sqlx::query_as::<_, GroupInvite>(
        r#"
        INSERT INTO group_invites (group_id, inviter_id, invitee_id, max_uses)
        VALUES ($1, $2, $3, 1)
        RETURNING *
        "#,
    )
    .bind(group_id)
    .bind(inviter_id)
    .bind(invitee_id)
    .fetch_one(pool)
    .await
}

/// Get invite by code.
pub async fn get_invite_by_code(pool: &PgPool, code: &str) -> sqlx::Result<Option<GroupInvite>> {
    sqlx::query_as::<_, GroupInvite>(
        r#"
        SELECT * FROM group_invites
        WHERE invite_code = $1
          AND (max_uses IS NULL OR use_count < max_uses)
          AND (expires_at IS NULL OR expires_at > NOW())
        "#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await
}

/// Use an invite (increment use count).
pub async fn use_invite(pool: &PgPool, invite_id: Uuid) -> sqlx::Result<()> {
    sqlx::query(
        r#"
        UPDATE group_invites
        SET use_count = use_count + 1
        WHERE id = $1
        "#,
    )
    .bind(invite_id)
    .execute(pool)
    .await?;
    Ok(())
}

// ============================================================================
// Messages
// ============================================================================

/// Store a group message.
pub async fn store_message(
    pool: &PgPool,
    group_id: Uuid,
    sender_id: Uuid,
    ciphertext: &[u8],
    sender_key_id: i32,
    message_type: i16,
    reply_to_id: Option<Uuid>,
) -> sqlx::Result<GroupMessage> {
    sqlx::query_as::<_, GroupMessage>(
        r#"
        INSERT INTO group_messages (group_id, sender_id, ciphertext, sender_key_id, message_type, reply_to_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(group_id)
    .bind(sender_id)
    .bind(ciphertext)
    .bind(sender_key_id)
    .bind(message_type)
    .bind(reply_to_id)
    .fetch_one(pool)
    .await
}

/// Get messages for a group.
pub async fn get_messages(
    pool: &PgPool,
    group_id: Uuid,
    limit: i64,
    before: Option<time::OffsetDateTime>,
) -> sqlx::Result<Vec<GroupMessage>> {
    if let Some(before) = before {
        sqlx::query_as::<_, GroupMessage>(
            r#"
            SELECT * FROM group_messages
            WHERE group_id = $1 AND created_at < $3
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(group_id)
        .bind(limit)
        .bind(before)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, GroupMessage>(
            r#"
            SELECT * FROM group_messages
            WHERE group_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(group_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }
}
