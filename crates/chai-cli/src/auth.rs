//! Authentication module for identity key-based auth.
//!
//! Implements passwordless authentication using Ed25519 signatures.

use crate::config::Config;
use anyhow::{anyhow, Result};
use chai_crypto::{
    keys::IdentityKeyPair,
    mnemonic::{
        derive_identity_from_words, generate_mnemonic, validate_mnemonic, MnemonicStrength,
    },
};
use serde::{Deserialize, Serialize};

/// HTTP client for auth API.
pub struct AuthClient {
    client: reqwest::Client,
    base_url: String,
}

// Request/Response types matching the server

#[derive(Debug, Serialize)]
struct RegisterRequest {
    username: String,
    identity_key: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct RegisterResponse {
    user_id: String,
    session_token: String,
}

#[derive(Debug, Serialize)]
struct ChallengeRequest {
    username: String,
}

#[derive(Debug, Deserialize)]
struct ChallengeResponse {
    challenge: Vec<u8>,
    expires_at: i64,
}

#[derive(Debug, Serialize)]
struct VerifyRequest {
    username: String,
    challenge: Vec<u8>,
    signature: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct VerifyResponse {
    user_id: String,
    session_token: String,
}

#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: String,
}

impl AuthClient {
    /// Create a new auth client.
    pub fn new(base_url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.to_string(),
        }
    }

    /// Register a new user with username and identity key.
    pub async fn register(
        &self,
        username: &str,
        identity: &IdentityKeyPair,
    ) -> Result<(String, String)> {
        let public_key = identity.public_key().to_bytes().to_vec();

        let resp = self
            .client
            .post(format!("{}/auth/identity/register", self.base_url))
            .json(&RegisterRequest {
                username: username.to_string(),
                identity_key: public_key,
            })
            .send()
            .await?;

        if resp.status().is_success() {
            let data: RegisterResponse = resp.json().await?;
            Ok((data.user_id, data.session_token))
        } else {
            let err: ErrorResponse = resp.json().await.unwrap_or(ErrorResponse {
                error: "Unknown error".into(),
            });
            Err(anyhow!("Registration failed: {}", err.error))
        }
    }

    /// Login with challenge-response signature.
    pub async fn login(
        &self,
        username: &str,
        identity: &IdentityKeyPair,
    ) -> Result<(String, String)> {
        // Step 1: Request challenge
        let resp = self
            .client
            .post(format!("{}/auth/identity/challenge", self.base_url))
            .json(&ChallengeRequest {
                username: username.to_string(),
            })
            .send()
            .await?;

        if !resp.status().is_success() {
            let err: ErrorResponse = resp.json().await.unwrap_or(ErrorResponse {
                error: "Unknown error".into(),
            });
            return Err(anyhow!("Challenge request failed: {}", err.error));
        }

        let challenge_resp: ChallengeResponse = resp.json().await?;

        // Step 2: Sign the challenge
        let signature = identity.sign(&challenge_resp.challenge);

        // Step 3: Verify signature
        let resp = self
            .client
            .post(format!("{}/auth/identity/verify", self.base_url))
            .json(&VerifyRequest {
                username: username.to_string(),
                challenge: challenge_resp.challenge,
                signature,
            })
            .send()
            .await?;

        if resp.status().is_success() {
            let data: VerifyResponse = resp.json().await?;
            Ok((data.user_id, data.session_token))
        } else {
            let err: ErrorResponse = resp.json().await.unwrap_or(ErrorResponse {
                error: "Unknown error".into(),
            });
            Err(anyhow!("Login failed: {}", err.error))
        }
    }
}

/// Generate a new 24-word mnemonic.
pub fn new_mnemonic() -> String {
    generate_mnemonic(MnemonicStrength::Words24)
}

/// Validate a mnemonic phrase.
pub fn is_valid_mnemonic(words: &str) -> bool {
    validate_mnemonic(words)
}

/// Derive identity from mnemonic.
pub fn identity_from_mnemonic(words: &str) -> Result<IdentityKeyPair> {
    derive_identity_from_words(words, "").map_err(|e| anyhow!("Invalid mnemonic: {:?}", e))
}

/// Perform registration flow.
pub async fn register_flow(config: &mut Config, username: &str, mnemonic: &str) -> Result<()> {
    // Derive identity from mnemonic
    let identity = identity_from_mnemonic(mnemonic)?;

    // Register with server
    let client = AuthClient::new(&config.server_url);
    let (user_id, session_token) = client.register(username, &identity).await?;

    // Save to config
    config.username = Some(username.to_string());
    config.user_id = Some(user_id);
    config.session_token = Some(session_token);
    config.set_identity(&identity);
    config.save()?;

    Ok(())
}

/// Perform login flow with existing mnemonic.
pub async fn login_flow(config: &mut Config, username: &str, mnemonic: &str) -> Result<()> {
    // Derive identity from mnemonic
    let identity = identity_from_mnemonic(mnemonic)?;

    // Login with server
    let client = AuthClient::new(&config.server_url);
    let (user_id, session_token) = client.login(username, &identity).await?;

    // Save to config
    config.username = Some(username.to_string());
    config.user_id = Some(user_id);
    config.session_token = Some(session_token);
    config.set_identity(&identity);
    config.save()?;

    Ok(())
}

/// Login with stored identity key (skip mnemonic entry).
pub async fn login_with_stored_identity(config: &mut Config) -> Result<()> {
    let username = config
        .username
        .as_ref()
        .ok_or_else(|| anyhow!("No username stored"))?;
    let identity = config
        .get_identity()
        .ok_or_else(|| anyhow!("No identity key stored"))?;

    let client = AuthClient::new(&config.server_url);
    let (user_id, session_token) = client.login(username, &identity).await?;

    config.user_id = Some(user_id);
    config.session_token = Some(session_token);
    config.save()?;

    Ok(())
}
