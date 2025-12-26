//! CLI configuration.

use anyhow::Result;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server URL.
    pub server_url: String,
    /// Username.
    pub username: Option<String>,
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
            server_url: "wss://api.chai.im/ws".into(),
            username: None,
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
        ProjectDirs::from("im", "chai", "chai-cli")
            .map(|dirs| dirs.config_dir().to_path_buf())
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
}
