//! Quick test script for CLI chat flow
//! Run with: cargo run --example test_chat

use chai_crypto::mnemonic::{derive_identity_from_words, generate_mnemonic, MnemonicStrength};
use reqwest::Client;
use serde::{Deserialize, Serialize};

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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let server = "https://chai-server.fly.dev";

    // Generate mnemonic and derive identity
    let mnemonic = generate_mnemonic(MnemonicStrength::Words24);
    println!("Generated mnemonic: {}", mnemonic);

    let identity = derive_identity_from_words(&mnemonic, "")?;
    let public_key = identity.public_key().to_bytes().to_vec();
    println!("Identity public key: {} bytes", public_key.len());

    // Generate unique username
    let username = format!(
        "test_cli_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs()
    );
    println!("Username: {}", username);

    // Register
    let client = Client::new();
    let resp = client
        .post(format!("{}/auth/identity/register", server))
        .json(&RegisterRequest {
            username: username.clone(),
            identity_key: public_key,
        })
        .send()
        .await?;

    if resp.status().is_success() {
        let data: RegisterResponse = resp.json().await?;
        println!("Registration successful!");
        println!("User ID: {}", data.user_id);
        println!("Session token: {}...", &data.session_token[..20]);
    } else {
        println!("Registration failed: {}", resp.text().await?);
    }

    Ok(())
}
