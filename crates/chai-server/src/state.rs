//! Application state.

use crate::config::Config;
use crate::ws::connection::ConnectionManager;
use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::RwLock;
use webauthn_rs::prelude::*;

/// Shared application state.
pub struct AppState {
    /// Database connection pool.
    pub db: PgPool,
    /// WebAuthn authenticator.
    pub webauthn: Webauthn,
    /// Active WebSocket connections.
    pub connections: Arc<RwLock<ConnectionManager>>,
    /// Configuration.
    pub config: Config,
}

impl AppState {
    /// Create new application state.
    pub async fn new(config: &Config) -> Result<Self> {
        // Create database pool
        let db = PgPoolOptions::new()
            .max_connections(50)
            .connect(&config.database_url)
            .await?;

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&db)
            .await?;

        // Create WebAuthn
        let rp_id = config.rp_id.clone();
        let rp_origin = Url::parse(&config.rp_origin)?;
        let builder = WebauthnBuilder::new(&rp_id, &rp_origin)?
            .rp_name("Chai.im");
        let webauthn = builder.build()?;

        Ok(Self {
            db,
            webauthn,
            connections: Arc::new(RwLock::new(ConnectionManager::new())),
            config: config.clone(),
        })
    }
}
