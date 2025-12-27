//! Chai.im WebSocket server.

use axum::{
    http::{header, Method},
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use chai_server::config::Config;
use chai_server::state::AppState;
use chai_server::{handlers, ws};

/// Build the application router.
pub fn build_router(state: Arc<AppState>) -> Router {
    let config = &state.config;

    Router::new()
        // Health check
        .route("/health", get(handlers::health::health_check))
        // WebAuthn auth endpoints
        .route("/auth/register/start", post(handlers::auth::register_start))
        .route(
            "/auth/register/complete",
            post(handlers::auth::register_complete),
        )
        .route("/auth/login/start", post(handlers::auth::login_start))
        .route("/auth/login/complete", post(handlers::auth::login_complete))
        // Password auth endpoints
        .route(
            "/auth/password/register",
            post(handlers::password_auth::password_register),
        )
        .route(
            "/auth/password/login",
            post(handlers::password_auth::password_login),
        )
        // Prekey endpoints
        .route(
            "/prekeys/bundle/:user_id",
            get(handlers::prekeys::get_bundle),
        )
        .route("/prekeys/bundle", post(handlers::prekeys::upload_bundle))
        .route(
            "/prekeys/one-time",
            post(handlers::prekeys::upload_one_time),
        )
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
        .route(
            "/groups/:group_id/members",
            get(handlers::groups::list_members),
        )
        .route(
            "/groups/:group_id/members",
            post(handlers::groups::add_member),
        )
        .route(
            "/groups/:group_id/members/:user_id",
            delete(handlers::groups::remove_member),
        )
        .route(
            "/groups/:group_id/invites",
            post(handlers::groups::create_invite),
        )
        // WebSocket endpoint
        .route("/ws", get(ws::handler::ws_handler))
        // Middleware
        .layer({
            // Parse the origin from config
            let origin = config
                .rp_origin
                .parse::<axum::http::HeaderValue>()
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
                .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT])
                .allow_credentials(true)
        })
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

// Shuttle entry point
#[cfg(feature = "shuttle")]
#[shuttle_runtime::main]
async fn shuttle_main(
    #[shuttle_shared_db::Postgres] pool: sqlx::PgPool,
) -> shuttle_axum::ShuttleAxum {
    use chai_server::state::AppState;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Create config from environment (Shuttle sets these via Secrets.toml)
    let config = Config {
        port: 8000,                  // Shuttle handles the port
        database_url: String::new(), // Not needed, we have the pool
        rp_id: std::env::var("RP_ID").unwrap_or_else(|_| "chai-server.shuttleapp.rs".into()),
        rp_origin: std::env::var("RP_ORIGIN")
            .unwrap_or_else(|_| "https://chai-im.vercel.app".into()),
        jwt_secret: std::env::var("JWT_SECRET").expect("JWT_SECRET must be set in Secrets.toml"),
    };

    // Create app state with the provided pool
    let state = AppState::with_pool(pool, &config)
        .await
        .expect("Failed to create app state");

    let router = build_router(Arc::new(state));
    Ok(router.into())
}

// Standalone entry point
#[cfg(not(feature = "shuttle"))]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    use std::net::SocketAddr;
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

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
    let app = build_router(Arc::new(state));

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
