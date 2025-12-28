//! Waitlist signup handlers.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct WaitlistSignupRequest {
    pub email: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub referrer: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WaitlistSignupResponse {
    pub success: bool,
    pub message: String,
    pub position: Option<i64>,
}

#[derive(Debug, FromRow)]
#[allow(dead_code)]
struct WaitlistEntry {
    id: uuid::Uuid,
}

/// Add email to waitlist.
pub async fn signup(
    State(state): State<Arc<AppState>>,
    Json(req): Json<WaitlistSignupRequest>,
) -> impl IntoResponse {
    // Validate email format
    let email = req.email.trim().to_lowercase();
    if !is_valid_email(&email) {
        return (
            StatusCode::BAD_REQUEST,
            Json(WaitlistSignupResponse {
                success: false,
                message: "Invalid email address".to_string(),
                position: None,
            }),
        );
    }

    // Check if already signed up
    let existing: Option<WaitlistEntry> =
        sqlx::query_as("SELECT id FROM waitlist WHERE email = $1")
            .bind(&email)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    if existing.is_some() {
        // Get their position
        let position = get_position(&state, &email).await;
        return (
            StatusCode::OK,
            Json(WaitlistSignupResponse {
                success: true,
                message: "You're already on the waitlist!".to_string(),
                position,
            }),
        );
    }

    // Insert into waitlist
    let result = sqlx::query(
        r#"
        INSERT INTO waitlist (email, source, referrer)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(&email)
    .bind(req.source.as_deref().unwrap_or("website"))
    .bind(req.referrer.as_deref())
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let position = get_position(&state, &email).await;
            tracing::info!("New waitlist signup: {} (position: {:?})", email, position);
            (
                StatusCode::CREATED,
                Json(WaitlistSignupResponse {
                    success: true,
                    message: "You're on the list! We'll notify you at launch.".to_string(),
                    position,
                }),
            )
        }
        Err(e) => {
            tracing::error!("Failed to add to waitlist: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(WaitlistSignupResponse {
                    success: false,
                    message: "Something went wrong. Please try again.".to_string(),
                    position: None,
                }),
            )
        }
    }
}

/// Get waitlist count (for display).
pub async fn count(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    #[derive(Serialize)]
    struct CountResponse {
        count: i64,
    }

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM waitlist")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    Json(CountResponse { count: count.0 })
}

/// Get position in waitlist.
async fn get_position(state: &AppState, email: &str) -> Option<i64> {
    let result: Option<(i64,)> = sqlx::query_as(
        r#"
        SELECT COUNT(*) + 1 FROM waitlist
        WHERE created_at < (SELECT created_at FROM waitlist WHERE email = $1)
        "#,
    )
    .bind(email)
    .fetch_optional(&state.db)
    .await
    .ok()?;

    result.map(|(pos,)| pos)
}

/// Simple email validation.
fn is_valid_email(email: &str) -> bool {
    if email.len() > 254 {
        return false;
    }

    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false;
    }

    let local = parts[0];
    let domain = parts[1];

    // Basic checks
    !local.is_empty()
        && !domain.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
}
