//! E2E encrypted echo bot for testing Chai.im chat.
//!
//! Run with: cargo run --example chat_bot
//!
//! The bot:
//! 1. Registers as "chai_bot" (or logs in if already registered)
//! 2. Connects via WebSocket and uploads prekey bundle
//! 3. Receives encrypted messages (Prekey or Normal)
//! 4. Decrypts them, prefixes with "Echo: ", encrypts, sends back

use chai_common::uuid;
use chai_crypto::mnemonic::derive_identity_from_words;
use chai_crypto::session::{EncryptedMessage, PrekeyMessagePayload, Session};
use chai_crypto::{IdentityKeyPair, OneTimePreKey, SignedPreKey};
use chai_protocol::wire::json;
use chai_protocol::{ClientMessage, MessageType, OneTimePrekey, PrekeyBundleData, ServerMessage};
use futures_util::{SinkExt, StreamExt};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const SERVER: &str = "https://chai-server.fly.dev";
const WS_SERVER: &str = "wss://chai-server.fly.dev/ws";
const BOT_USERNAME: &str = "chai_bot";

// Hardcoded mnemonic so the bot gets the same identity every time.
// In production you'd store this securely.
const BOT_MNEMONIC: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

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

struct BotState {
    #[allow(dead_code)]
    user_id: String,
    #[allow(dead_code)]
    session_token: String,
    identity: IdentityKeyPair,
    signed_prekey: SignedPreKey,
    one_time_prekeys: Vec<OneTimePreKey>,
    sessions: HashMap<String, Session>,
}

/// Register or login the bot. Returns (username, user_id, session_token).
async fn authenticate(identity: &IdentityKeyPair) -> anyhow::Result<(String, String, String)> {
    let http = HttpClient::new();
    let public_key = identity.public_key().to_bytes().to_vec();

    // Try to register with preferred name first
    let resp = http
        .post(format!("{}/auth/identity/register", SERVER))
        .json(&RegisterRequest {
            username: BOT_USERNAME.into(),
            identity_key: public_key.clone(),
        })
        .send()
        .await?;

    if resp.status().is_success() {
        let data: RegisterResponse = resp.json().await?;
        return Ok((BOT_USERNAME.into(), data.user_id, data.session_token));
    }

    // Registration failed — try login (challenge-response)
    let resp = http
        .post(format!("{}/auth/identity/challenge", SERVER))
        .json(&ChallengeRequest {
            username: BOT_USERNAME.into(),
        })
        .send()
        .await?;

    if resp.status().is_success() {
        let challenge: ChallengeResponse = resp.json().await?;
        let signature_bytes = identity.sign(&challenge.challenge);

        let resp = http
            .post(format!("{}/auth/identity/verify", SERVER))
            .json(&VerifyRequest {
                username: BOT_USERNAME.into(),
                challenge: challenge.challenge,
                signature: signature_bytes,
            })
            .send()
            .await?;

        if resp.status().is_success() {
            let verify: VerifyResponse = resp.json().await?;
            return Ok((BOT_USERNAME.into(), verify.user_id, verify.session_token));
        }
    }

    // Login failed too (identity key mismatch) — register with a new unique name
    let key_bytes = identity.public_key().to_bytes();
    let unique_name = format!(
        "echo_bot_{:02x}{:02x}{:02x}{:02x}",
        key_bytes[0], key_bytes[1], key_bytes[2], key_bytes[3]
    );
    println!(
        "[bot] '{}' taken with different key, registering as '{}'",
        BOT_USERNAME, unique_name
    );

    let resp = http
        .post(format!("{}/auth/identity/register", SERVER))
        .json(&RegisterRequest {
            username: unique_name.clone(),
            identity_key: public_key,
        })
        .send()
        .await?;

    if resp.status().is_success() {
        let data: RegisterResponse = resp.json().await?;
        return Ok((unique_name, data.user_id, data.session_token));
    }

    // Even fallback name might already exist from a previous run — try login
    let resp = http
        .post(format!("{}/auth/identity/challenge", SERVER))
        .json(&ChallengeRequest {
            username: unique_name.clone(),
        })
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        anyhow::bail!("All auth attempts failed: {}", text);
    }

    let challenge: ChallengeResponse = resp.json().await?;
    let signature_bytes = identity.sign(&challenge.challenge);

    let resp = http
        .post(format!("{}/auth/identity/verify", SERVER))
        .json(&VerifyRequest {
            username: unique_name.clone(),
            challenge: challenge.challenge,
            signature: signature_bytes,
        })
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        anyhow::bail!("Verify failed: {}", text);
    }

    let verify: VerifyResponse = resp.json().await?;
    Ok((unique_name, verify.user_id, verify.session_token))
}

/// Decode a ServerMessage from a WebSocket frame (text or binary).
fn decode_ws_message(msg: Message) -> Option<ServerMessage> {
    let text = match msg {
        Message::Text(t) => Some(t.to_string()),
        Message::Binary(b) => String::from_utf8(b.to_vec()).ok(),
        _ => None,
    };
    text.and_then(|t| json::decode_server_message(&t).ok())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Derive identity from fixed mnemonic
    let identity = derive_identity_from_words(BOT_MNEMONIC, "")?;

    println!("[bot] Authenticating as '{}'...", BOT_USERNAME);
    let (bot_name, user_id, session_token) = authenticate(&identity).await?;
    println!("[bot] Authenticated! ID: {}", &user_id[..8]);

    // Generate prekeys
    let signed_prekey = SignedPreKey::generate(1, &identity);
    let mut one_time_prekeys = Vec::new();
    for i in 1..=20 {
        one_time_prekeys.push(OneTimePreKey::generate(i));
    }

    // Connect WebSocket
    println!("[bot] Connecting to WebSocket...");
    let ws_url = format!("{}?token={}", WS_SERVER, session_token);
    let (ws_stream, _) = connect_async(&ws_url).await?;
    let (mut sink, mut stream) = ws_stream.split();
    println!("[bot] Connected!");

    // Upload prekey bundle
    let bundle = PrekeyBundleData {
        identity_key: identity.public_key().to_bytes().to_vec(),
        signed_prekey: signed_prekey.public_key().to_bytes().to_vec(),
        signed_prekey_signature: signed_prekey.signature.clone(),
        signed_prekey_id: signed_prekey.id,
        one_time_prekey: one_time_prekeys
            .first()
            .map(|k| k.public_key().to_bytes().to_vec()),
        one_time_prekey_id: one_time_prekeys.first().map(|k| k.id),
    };
    let msg_text = json::encode_client_message(&ClientMessage::UploadPrekeyBundle { bundle })
        .map_err(|e| anyhow::anyhow!("{:?}", e))?;
    sink.send(Message::Text(msg_text)).await?;

    // Upload all one-time prekeys
    let otks: Vec<OneTimePrekey> = one_time_prekeys
        .iter()
        .map(|k| OneTimePrekey {
            id: k.id,
            key: k.public_key().to_bytes().to_vec(),
        })
        .collect();
    let msg_text =
        json::encode_client_message(&ClientMessage::UploadOneTimePrekeys { prekeys: otks })
            .map_err(|e| anyhow::anyhow!("{:?}", e))?;
    sink.send(Message::Text(msg_text)).await?;
    println!("[bot] Keys uploaded!");

    let mut state = BotState {
        user_id: user_id.clone(),
        session_token,
        identity,
        signed_prekey,
        one_time_prekeys,
        sessions: HashMap::new(),
    };

    println!("\n========================================");
    println!("  Bot '{}' is online!", bot_name);
    println!("  User ID: {}", user_id);
    println!("  In the TUI, type:  :chat {}", bot_name);
    println!("========================================\n");
    println!("[bot] Waiting for messages... (Ctrl+C to stop)");

    // Message loop
    while let Some(Ok(ws_msg)) = stream.next().await {
        let Some(server_msg) = decode_ws_message(ws_msg) else {
            continue;
        };

        match server_msg {
            ServerMessage::Message {
                sender_id,
                ciphertext,
                message_type,
                ..
            } => {
                let peer_id = sender_id.0.to_string();
                println!(
                    "[bot] Message from {} ({} bytes, type: {:?})",
                    &peer_id[..8],
                    ciphertext.len(),
                    message_type,
                );

                // Decrypt
                let plaintext = decrypt_message(&mut state, &peer_id, &ciphertext, message_type);

                match plaintext {
                    Some(text) => {
                        println!("[bot] Decrypted: \"{}\"", text);

                        // Echo back encrypted
                        let echo = format!("Echo: {}", text);
                        if let Some(reply_ct) = encrypt_reply(&mut state, &peer_id, &echo) {
                            let recipient_uuid: uuid::Uuid = peer_id.parse().unwrap();
                            let reply = ClientMessage::SendMessage {
                                recipient_id: chai_common::UserId(recipient_uuid),
                                conversation_id: chai_common::ConversationId(recipient_uuid),
                                ciphertext: reply_ct,
                                message_type: MessageType::Normal,
                            };
                            let msg_text = json::encode_client_message(&reply)
                                .map_err(|e| anyhow::anyhow!("{:?}", e))?;
                            sink.send(Message::Text(msg_text)).await?;
                            println!("[bot] Sent encrypted echo: \"{}\"", echo);
                        } else {
                            println!("[bot] Failed to encrypt echo");
                        }
                    }
                    None => {
                        println!("[bot] Could not decrypt message");
                    }
                }
            }
            ServerMessage::LowPrekeys { remaining } => {
                println!("[bot] Low prekeys warning: {} remaining", remaining);
                // Generate and upload more
                let start_id = state.one_time_prekeys.len() as u32 + 21;
                for i in start_id..start_id + 20 {
                    state.one_time_prekeys.push(OneTimePreKey::generate(i));
                }
                let otks: Vec<OneTimePrekey> = state
                    .one_time_prekeys
                    .iter()
                    .rev()
                    .take(20)
                    .map(|k| OneTimePrekey {
                        id: k.id,
                        key: k.public_key().to_bytes().to_vec(),
                    })
                    .collect();
                let msg_text = json::encode_client_message(&ClientMessage::UploadOneTimePrekeys {
                    prekeys: otks,
                })
                .map_err(|e| anyhow::anyhow!("{:?}", e))?;
                sink.send(Message::Text(msg_text)).await?;
                println!("[bot] Uploaded more prekeys");
            }
            ServerMessage::Error { message, .. } => {
                println!("[bot] Error: {}", message);
            }
            other => {
                println!("[bot] Other: {:?}", std::mem::discriminant(&other));
            }
        }
    }

    println!("[bot] Disconnected");
    Ok(())
}

/// Decrypt an incoming message, handling both Prekey (initial) and Normal types.
fn decrypt_message(
    state: &mut BotState,
    peer_id: &str,
    ciphertext: &[u8],
    message_type: MessageType,
) -> Option<String> {
    // Handle initial prekey message (X3DH handshake + first encrypted message)
    if message_type == MessageType::Prekey {
        match PrekeyMessagePayload::from_bytes(ciphertext) {
            Ok(payload) => {
                println!(
                    "[bot] Prekey message: spk_id={}, otk_id={:?}",
                    payload.initial_message.signed_prekey_id,
                    payload.initial_message.one_time_prekey_id,
                );

                match Session::receive(
                    &state.identity,
                    &state.signed_prekey,
                    &mut state.one_time_prekeys,
                    peer_id.to_string(),
                    &payload.initial_message,
                ) {
                    Ok(mut session) => match session.decrypt(&payload.encrypted_message) {
                        Ok(plaintext) => {
                            state.sessions.insert(peer_id.to_string(), session);
                            return Some(String::from_utf8_lossy(&plaintext).to_string());
                        }
                        Err(e) => {
                            println!("[bot] Prekey decrypt error: {:?}", e);
                        }
                    },
                    Err(e) => {
                        println!("[bot] Session::receive error: {:?}", e);
                    }
                }
            }
            Err(e) => {
                println!("[bot] Failed to parse PrekeyMessagePayload: {:?}", e);
            }
        }
    }

    // Try existing session (for Normal messages or retries)
    if let Some(session) = state.sessions.get_mut(peer_id) {
        if let Ok(encrypted) = EncryptedMessage::from_bytes(ciphertext) {
            if let Ok(plaintext) = session.decrypt(&encrypted) {
                return Some(String::from_utf8_lossy(&plaintext).to_string());
            }
        }
    }

    None
}

/// Encrypt a reply for a peer using an existing session.
fn encrypt_reply(state: &mut BotState, peer_id: &str, content: &str) -> Option<Vec<u8>> {
    let session = state.sessions.get_mut(peer_id)?;
    let encrypted = session.encrypt(content.as_bytes()).ok()?;
    encrypted.to_bytes().ok()
}
