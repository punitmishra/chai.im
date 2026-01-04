//! CLI configuration.

use anyhow::Result;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chai_crypto::keys::IdentityKeyPair;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server base URL (for API requests).
    pub server_url: String,
    /// WebSocket URL (for real-time messaging).
    pub ws_url: String,
    /// Username.
    pub username: Option<String>,
    /// User ID (after login).
    #[serde(default)]
    pub user_id: Option<String>,
    /// Session token (after login).
    #[serde(default)]
    pub session_token: Option<String>,
    /// Identity key bytes (32 bytes, base64 encoded).
    #[serde(default)]
    pub identity_key: Option<String>,
    /// Theme.
    pub theme: Theme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    /// Primary color.
    pub primary: String,
    /// Background color.
    pub background: String,
    /// Text color.
    pub text: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: "http://localhost:8080".into(),
            ws_url: "ws://localhost:8080/ws".into(),
            username: None,
            user_id: None,
            session_token: None,
            identity_key: None,
            theme: Theme::default(),
        }
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            primary: "#f59e0b".into(),
            background: "#0a0a0a".into(),
            text: "#ffffff".into(),
        }
    }
}

impl Config {
    /// Get the config directory path.
    pub fn config_dir() -> Option<PathBuf> {
        ProjectDirs::from("im", "chai", "chai-cli").map(|dirs| dirs.config_dir().to_path_buf())
    }

    /// Get the config file path.
    pub fn config_path() -> Option<PathBuf> {
        Self::config_dir().map(|dir| dir.join("config.toml"))
    }

    /// Load configuration from file or create default.
    pub fn load() -> Result<Self> {
        if let Some(path) = Self::config_path() {
            if path.exists() {
                let content = std::fs::read_to_string(&path)?;
                let config: Config = toml::from_str(&content)?;
                return Ok(config);
            }
        }
        Ok(Self::default())
    }

    /// Save configuration to file.
    pub fn save(&self) -> Result<()> {
        if let Some(dir) = Self::config_dir() {
            std::fs::create_dir_all(&dir)?;
            if let Some(path) = Self::config_path() {
                let content = toml::to_string_pretty(self)?;
                std::fs::write(path, content)?;
            }
        }
        Ok(())
    }

    /// Check if user is authenticated.
    pub fn is_authenticated(&self) -> bool {
        self.session_token.is_some() && self.user_id.is_some() && self.identity_key.is_some()
    }

    /// Get the identity key pair if stored.
    pub fn get_identity(&self) -> Option<IdentityKeyPair> {
        self.identity_key.as_ref().and_then(|key_b64| {
            let bytes = BASE64.decode(key_b64).ok()?;
            if bytes.len() != 32 {
                return None;
            }
            let key_bytes: [u8; 32] = bytes.try_into().ok()?;
            Some(IdentityKeyPair::from_bytes(&key_bytes))
        })
    }

    /// Store the identity key pair.
    pub fn set_identity(&mut self, identity: &IdentityKeyPair) {
        let bytes = identity.to_bytes();
        self.identity_key = Some(BASE64.encode(bytes));
    }

    /// Clear all auth data.
    pub fn logout(&mut self) {
        self.username = None;
        self.user_id = None;
        self.session_token = None;
        self.identity_key = None;
    }
}
