//! Chai.im WebSocket server.

use axum::{
    http::{header, Method},
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::{
    cors::CorsLayer,
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
        // WebAuthn auth endpoints
        .route("/auth/register/start", post(handlers::auth::register_start))
        .route("/auth/register/complete", post(handlers::auth::register_complete))
        .route("/auth/login/start", post(handlers::auth::login_start))
        .route("/auth/login/complete", post(handlers::auth::login_complete))
        // Password auth endpoints
        .route("/auth/password/register", post(handlers::password_auth::password_register))
        .route("/auth/password/login", post(handlers::password_auth::password_login))
        // Prekey endpoints
        .route("/prekeys/bundle/:user_id", get(handlers::prekeys::get_bundle))
        .route("/prekeys/bundle", post(handlers::prekeys::upload_bundle))
        .route("/prekeys/one-time", post(handlers::prekeys::upload_one_time))
        // User endpoints
        .route("/users/search", get(handlers::users::search_users))
        .route("/users/:user_id", get(handlers::users::get_user_profile))
        // Group endpoints
        .route("/groups", get(handlers::groups::list_my_groups))
        .route("/groups", post(handlers::groups::create_group))
        .route("/groups/search", get(handlers::groups::search_groups))
        .route("/groups/join", post(handlers::groups::join_by_code))
        .route("/groups/:group_id", get(handlers::groups::get_group))
        .route("/groups/:group_id", put(handlers::groups::update_group))
        .route("/groups/:group_id", delete(handlers::groups::delete_group))
        .route("/groups/:group_id/members", get(handlers::groups::list_members))
        .route("/groups/:group_id/members", post(handlers::groups::add_member))
        .route("/groups/:group_id/members/:user_id", delete(handlers::groups::remove_member))
        .route("/groups/:group_id/invites", post(handlers::groups::create_invite))
        // WebSocket endpoint
        .route("/ws", get(ws::handler::ws_handler))
        // Middleware
        .layer({
            // Parse the origin from config
            let origin = config.rp_origin.parse::<axum::http::HeaderValue>()
                .expect("Invalid RP_ORIGIN URL");

            CorsLayer::new()
                .allow_origin(origin)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers([
                    header::CONTENT_TYPE,
                    header::AUTHORIZATION,
                    header::ACCEPT,
                ])
                .allow_credentials(true)
        })
        .layer(TraceLayer::new_for_http())
        .with_state(Arc::new(state));

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
