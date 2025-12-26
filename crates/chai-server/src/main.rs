//! Chai.im WebSocket server.

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use chai_server::config::Config;
use chai_server::state::AppState;
use chai_server::{handlers, ws};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "chai_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    // Create app state
    let state = AppState::new(&config).await?;

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(handlers::health::health_check))
        // Auth endpoints
        .route("/auth/register/start", post(handlers::auth::register_start))
        .route("/auth/register/complete", post(handlers::auth::register_complete))
        .route("/auth/login/start", post(handlers::auth::login_start))
        .route("/auth/login/complete", post(handlers::auth::login_complete))
        // Prekey endpoints
        .route("/prekeys/bundle/:user_id", get(handlers::prekeys::get_bundle))
        .route("/prekeys/bundle", post(handlers::prekeys::upload_bundle))
        .route("/prekeys/one-time", post(handlers::prekeys::upload_one_time))
        // User endpoints
        .route("/users/search", get(handlers::users::search_users))
        .route("/users/:user_id", get(handlers::users::get_user_profile))
        // WebSocket endpoint
        .route("/ws", get(ws::handler::ws_handler))
        // Middleware
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(Arc::new(state));

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
