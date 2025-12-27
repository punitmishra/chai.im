//! Common test utilities.

use axum::{routing::get, routing::post, Router};
use chai_server::{config::Config, handlers, state::AppState, ws};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

/// Test server wrapper.
pub struct TestServer {
    pub addr: SocketAddr,
    pub base_url: String,
    pub ws_url: String,
    _handle: tokio::task::JoinHandle<()>,
}

impl TestServer {
    /// Start a test server.
    /// Requires DATABASE_URL environment variable to be set.
    pub async fn start() -> anyhow::Result<Self> {
        // Load test config
        dotenvy::dotenv().ok();

        let config = Config {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/chai_test".into()),
            port: 0, // Random port
            rp_id: "localhost".into(),
            rp_origin: "http://localhost:3000".into(),
            jwt_secret: "test-secret-key-for-testing-only".into(),
        };

        // Create app state
        let state = AppState::new(&config).await?;
        let state = Arc::new(state);

        // Build router (same as main.rs)
        let app = Router::new()
            .route("/health", get(handlers::health::health_check))
            .route("/auth/register/start", post(handlers::auth::register_start))
            .route(
                "/auth/register/complete",
                post(handlers::auth::register_complete),
            )
            .route("/auth/login/start", post(handlers::auth::login_start))
            .route("/auth/login/complete", post(handlers::auth::login_complete))
            .route(
                "/prekeys/bundle/:user_id",
                get(handlers::prekeys::get_bundle),
            )
            .route("/prekeys/bundle", post(handlers::prekeys::upload_bundle))
            .route(
                "/prekeys/one-time",
                post(handlers::prekeys::upload_one_time),
            )
            .route("/users/search", get(handlers::users::search_users))
            .route("/users/:user_id", get(handlers::users::get_user_profile))
            .route("/ws", get(ws::handler::ws_handler))
            .layer(
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any),
            )
            .with_state(state);

        // Bind to random port
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;

        // Spawn server
        let handle = tokio::spawn(async move {
            axum::serve(listener, app).await.ok();
        });

        // Wait a bit for server to start
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let base_url = format!("http://{}", addr);
        let ws_url = format!("ws://{}/ws", addr);

        Ok(Self {
            addr,
            base_url,
            ws_url,
            _handle: handle,
        })
    }

    /// Get HTTP client.
    pub fn client(&self) -> reqwest::Client {
        reqwest::Client::new()
    }

    /// Build URL for an endpoint.
    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }
}

/// Create a test user directly in the database and return session token.
pub async fn create_test_user(
    pool: &sqlx::PgPool,
    username: &str,
) -> anyhow::Result<(String, String)> {
    use sha2::{Digest, Sha256};
    use uuid::Uuid;

    // Create user
    let user_id = Uuid::new_v4();
    let identity_key = vec![0u8; 32]; // Dummy key for testing

    sqlx::query(
        r#"
        INSERT INTO users (id, username, identity_key)
        VALUES ($1, $2, $3)
        ON CONFLICT (username) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(username)
    .bind(&identity_key)
    .execute(pool)
    .await?;

    // Create session token
    let token = format!("test-token-{}", Uuid::new_v4());
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hasher.finalize().to_vec();

    let expires_at = time::OffsetDateTime::now_utc() + time::Duration::days(30);

    sqlx::query(
        r#"
        INSERT INTO sessions (user_id, device_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(user_id)
    .bind(Uuid::new_v4())
    .bind(&token_hash)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok((user_id.to_string(), token))
}

/// Clean up test data.
pub async fn cleanup_test_user(pool: &sqlx::PgPool, username: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM users WHERE username = $1")
        .bind(username)
        .execute(pool)
        .await?;
    Ok(())
}
