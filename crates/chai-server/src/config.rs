//! Server configuration.

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    /// Server port.
    pub port: u16,
    /// Database URL.
    pub database_url: String,
    /// WebAuthn relying party ID.
    pub rp_id: String,
    /// WebAuthn relying party origin (single URL for WebAuthn).
    pub rp_origin: String,
    /// CORS allowed origins (comma-separated, defaults to rp_origin).
    pub cors_origins: String,
    /// JWT secret for session tokens.
    pub jwt_secret: String,
}

impl Config {
    /// Load configuration from environment variables.
    pub fn from_env() -> Result<Self> {
        let rp_origin = std::env::var("RP_ORIGIN")
            .unwrap_or_else(|_| "http://localhost:3000".into());

        Ok(Self {
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .context("Invalid PORT")?,
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/chai".into()),
            rp_id: std::env::var("RP_ID").unwrap_or_else(|_| "localhost".into()),
            cors_origins: std::env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| rp_origin.clone()),
            rp_origin,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "development-secret-change-in-production".into()),
        })
    }
}
