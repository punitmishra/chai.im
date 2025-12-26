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
    /// WebAuthn relying party origin.
    pub rp_origin: String,
    /// JWT secret for session tokens.
    pub jwt_secret: String,
}

impl Config {
    /// Load configuration from environment variables.
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .context("Invalid PORT")?,
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/chai".into()),
            rp_id: std::env::var("RP_ID")
                .unwrap_or_else(|_| "localhost".into()),
            rp_origin: std::env::var("RP_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "development-secret-change-in-production".into()),
        })
    }
}
