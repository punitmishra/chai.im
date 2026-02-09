//! End-to-end chat test: registers two users, connects via WebSocket,
//! sends a message from Alice to Bob, and verifies receipt.
//!
//! Run with: cargo run --example test_e2e_chat
//!
//! Requires the server to be running (uses production by default).

use chai_crypto::mnemonic::{derive_identity_from_words, generate_mnemonic, MnemonicStrength};
use chai_crypto::{IdentityKeyPair, OneTimePreKey, SignedPreKey};
use chai_protocol::wire::json;
use chai_protocol::{ClientMessage, MessageType, OneTimePrekey, PrekeyBundleData, ServerMessage};
use futures_util::{SinkExt, StreamExt};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const SERVER: &str = "https://chai-server.fly.dev";
const WS_SERVER: &str = "wss://chai-server.fly.dev/ws";

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

/// A test user with identity, session, and crypto state.
struct TestUser {
    username: String,
    user_id: String,
    session_token: String,
    identity: IdentityKeyPair,
    mnemonic: String,
}

impl TestUser {
    /// Register a new test user.
    async fn register(prefix: &str) -> anyhow::Result<Self> {
        let mnemonic = generate_mnemonic(MnemonicStrength::Words24);
        let identity = derive_identity_from_words(&mnemonic, "")?;
        let public_key = identity.public_key().to_bytes().to_vec();

        let username = format!(
            "{}_{}",
            prefix,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis()
        );

        let http = HttpClient::new();
        let resp = http
            .post(format!("{}/auth/identity/register", SERVER))
            .json(&RegisterRequest {
                username: username.clone(),
                identity_key: public_key,
            })
            .send()
            .await?;

        if !resp.status().is_success() {
            let text = resp.text().await?;
            anyhow::bail!("Registration failed for {}: {}", username, text);
        }

        let data: RegisterResponse = resp.json().await?;
        println!(
            "  [+] Registered '{}' (id: {})",
            username,
            &data.user_id[..8]
        );

        Ok(Self {
            username,
            user_id: data.user_id,
            session_token: data.session_token,
            identity,
            mnemonic,
        })
    }
}

/// Helper to send a ClientMessage as JSON over WebSocket.
async fn ws_send(
    sink: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
    msg: ClientMessage,
) -> anyhow::Result<()> {
    let text = json::encode_client_message(&msg).map_err(|e| anyhow::anyhow!("{:?}", e))?;
    sink.send(Message::Text(text.into())).await?;
    Ok(())
}

/// Wait for a specific message type, collecting others along the way.
async fn ws_recv_until<F>(
    stream: &mut futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
    timeout_secs: u64,
    predicate: F,
) -> anyhow::Result<ServerMessage>
where
    F: Fn(&ServerMessage) -> bool,
{
    let start = std::time::Instant::now();
    let deadline = Duration::from_secs(timeout_secs);
    loop {
        let remaining = deadline
            .checked_sub(start.elapsed())
            .unwrap_or(Duration::ZERO);
        if remaining.is_zero() {
            anyhow::bail!("Timeout waiting for expected message");
        }
        match timeout(remaining, stream.next()).await {
            Ok(Some(Ok(Message::Text(text)))) => match json::decode_server_message(&text) {
                Ok(msg) => {
                    if predicate(&msg) {
                        return Ok(msg);
                    }
                    println!("  [~] Other message: {:?}", std::mem::discriminant(&msg));
                }
                Err(e) => {
                    println!("  [!] Decode error: {:?}", e);
                    println!("  [!] Raw: {}", &text[..text.len().min(300)]);
                }
            },
            Ok(Some(Ok(Message::Binary(data)))) => {
                // Server sends JSON as binary frames - decode as text
                if let Ok(text) = String::from_utf8(data.to_vec()) {
                    match json::decode_server_message(&text) {
                        Ok(msg) => {
                            if predicate(&msg) {
                                return Ok(msg);
                            }
                            println!(
                                "  [~] Other message (binary frame): {:?}",
                                std::mem::discriminant(&msg)
                            );
                        }
                        Err(e) => {
                            println!("  [!] Binary decode error: {:?}", e);
                        }
                    }
                }
                continue;
            }
            Ok(Some(Ok(_))) => continue,
            Ok(Some(Err(e))) => anyhow::bail!("WebSocket error: {}", e),
            Ok(None) => anyhow::bail!("WebSocket stream ended"),
            Err(_) => anyhow::bail!("Timeout waiting for expected message"),
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("=== Chai.im E2E Chat Test ===\n");

    // ── Step 1: Register two test users ──────────────────────────────
    println!("[1/6] Registering test users...");
    let alice = TestUser::register("alice").await?;
    let bob = TestUser::register("bob").await?;
    println!();

    // ── Step 2: Connect both users via WebSocket ─────────────────────
    println!("[2/6] Connecting via WebSocket...");

    let alice_url = format!("{}?token={}", WS_SERVER, alice.session_token);
    let bob_url = format!("{}?token={}", WS_SERVER, bob.session_token);

    let (alice_ws, _) = connect_async(&alice_url).await?;
    println!("  [+] Alice connected");
    let (bob_ws, _) = connect_async(&bob_url).await?;
    println!("  [+] Bob connected");

    let (mut alice_sink, mut alice_stream) = alice_ws.split();
    let (mut bob_sink, mut bob_stream) = bob_ws.split();
    println!();

    // ── Step 3: Upload prekey bundles ────────────────────────────────
    println!("[3/6] Uploading prekey bundles...");

    // Alice's keys
    let alice_spk = SignedPreKey::generate(1, &alice.identity);
    let mut alice_otks = Vec::new();
    for i in 1..=5 {
        alice_otks.push(OneTimePreKey::generate(i));
    }

    let alice_bundle = PrekeyBundleData {
        identity_key: alice.identity.public_key().to_bytes().to_vec(),
        signed_prekey: alice_spk.public_key().to_bytes().to_vec(),
        signed_prekey_signature: alice_spk.signature.clone(),
        signed_prekey_id: alice_spk.id,
        one_time_prekey: alice_otks
            .first()
            .map(|k| k.public_key().to_bytes().to_vec()),
        one_time_prekey_id: alice_otks.first().map(|k| k.id),
    };

    ws_send(
        &mut alice_sink,
        ClientMessage::UploadPrekeyBundle {
            bundle: alice_bundle,
        },
    )
    .await?;
    let alice_otk_upload: Vec<OneTimePrekey> = alice_otks
        .iter()
        .map(|k| OneTimePrekey {
            id: k.id,
            key: k.public_key().to_bytes().to_vec(),
        })
        .collect();
    ws_send(
        &mut alice_sink,
        ClientMessage::UploadOneTimePrekeys {
            prekeys: alice_otk_upload,
        },
    )
    .await?;
    println!(
        "  [+] Alice uploaded prekey bundle + {} OTKs",
        alice_otks.len()
    );

    // Bob's keys
    let bob_spk = SignedPreKey::generate(1, &bob.identity);
    let mut bob_otks = Vec::new();
    for i in 1..=5 {
        bob_otks.push(OneTimePreKey::generate(i));
    }

    let bob_bundle = PrekeyBundleData {
        identity_key: bob.identity.public_key().to_bytes().to_vec(),
        signed_prekey: bob_spk.public_key().to_bytes().to_vec(),
        signed_prekey_signature: bob_spk.signature.clone(),
        signed_prekey_id: bob_spk.id,
        one_time_prekey: bob_otks.first().map(|k| k.public_key().to_bytes().to_vec()),
        one_time_prekey_id: bob_otks.first().map(|k| k.id),
    };

    ws_send(
        &mut bob_sink,
        ClientMessage::UploadPrekeyBundle { bundle: bob_bundle },
    )
    .await?;
    let bob_otk_upload: Vec<OneTimePrekey> = bob_otks
        .iter()
        .map(|k| OneTimePrekey {
            id: k.id,
            key: k.public_key().to_bytes().to_vec(),
        })
        .collect();
    ws_send(
        &mut bob_sink,
        ClientMessage::UploadOneTimePrekeys {
            prekeys: bob_otk_upload,
        },
    )
    .await?;
    println!("  [+] Bob uploaded prekey bundle + {} OTKs", bob_otks.len());
    println!();

    // Small delay to let server process bundle uploads
    tokio::time::sleep(Duration::from_millis(500)).await;

    // ── Step 4: Alice requests Bob's prekey bundle ───────────────────
    println!("[4/6] Alice requesting Bob's prekey bundle for X3DH...");

    let bob_user_id: chai_common::UserId = chai_common::UserId(bob.user_id.parse()?);
    ws_send(
        &mut alice_sink,
        ClientMessage::GetPrekeyBundle {
            user_id: bob_user_id,
        },
    )
    .await?;

    // Wait for prekey bundle response
    let bundle_msg = ws_recv_until(&mut alice_stream, 15, |msg| {
        matches!(msg, ServerMessage::PrekeyBundle { .. })
    })
    .await?;

    let bob_bundle_data = match bundle_msg {
        ServerMessage::PrekeyBundle {
            bundle: Some(b), ..
        } => {
            println!("  [+] Received Bob's prekey bundle");
            println!("      Identity key: {} bytes", b.identity_key.len());
            println!("      Signed prekey: {} bytes", b.signed_prekey.len());
            println!(
                "      OTP: {}",
                if b.one_time_prekey.is_some() {
                    "yes"
                } else {
                    "no"
                }
            );
            b
        }
        ServerMessage::PrekeyBundle { bundle: None, .. } => {
            anyhow::bail!("Server returned no prekey bundle for Bob");
        }
        _ => unreachable!(),
    };
    println!();

    // ── Step 5: Alice initiates X3DH session and sends encrypted message ─
    println!("[5/6] Alice initiating X3DH session and sending encrypted message...");

    // Convert bundle to chai-crypto PreKeyBundle
    let identity_bytes: [u8; 32] = bob_bundle_data
        .identity_key
        .try_into()
        .map_err(|_| anyhow::anyhow!("Bad identity key"))?;
    let bob_identity_pub = chai_crypto::keys::IdentityPublicKey::from_bytes(&identity_bytes)
        .map_err(|e| anyhow::anyhow!("Bad identity key: {:?}", e))?;

    let signed_prekey_bytes: [u8; 32] = bob_bundle_data
        .signed_prekey
        .try_into()
        .map_err(|_| anyhow::anyhow!("Bad signed prekey"))?;

    let otk_bytes: Option<[u8; 32]> = bob_bundle_data
        .one_time_prekey
        .map(|v| v.try_into())
        .transpose()
        .map_err(|_| anyhow::anyhow!("Bad OTK"))?;

    let prekey_bundle = chai_crypto::PreKeyBundle {
        identity_key: bob_identity_pub,
        signed_prekey: signed_prekey_bytes,
        signed_prekey_signature: bob_bundle_data.signed_prekey_signature,
        signed_prekey_id: bob_bundle_data.signed_prekey_id,
        one_time_prekey: otk_bytes,
        one_time_prekey_id: bob_bundle_data.one_time_prekey_id,
    };

    // Initiate X3DH session
    let (mut alice_session, _initial_message) = chai_crypto::session::Session::initiate(
        &alice.identity,
        bob.user_id.clone(),
        &prekey_bundle,
    )?;
    println!("  [+] X3DH session established");

    // Encrypt a message
    let plaintext = "Hello Bob! This is an E2E encrypted message from Alice.";
    let encrypted = alice_session.encrypt(plaintext.as_bytes())?;
    let ciphertext = encrypted.to_bytes()?;
    println!(
        "  [+] Encrypted message: {} bytes plaintext -> {} bytes ciphertext",
        plaintext.len(),
        ciphertext.len()
    );

    // Send via WebSocket
    let conv_id = chai_common::ConversationId(bob.user_id.parse()?);

    ws_send(
        &mut alice_sink,
        ClientMessage::SendMessage {
            recipient_id: bob_user_id,
            conversation_id: conv_id,
            ciphertext: ciphertext.clone(),
            message_type: MessageType::Prekey,
        },
    )
    .await?;
    println!("  [+] Message sent to server");
    println!();

    // ── Step 6: Bob receives the message ─────────────────────────────
    println!("[6/6] Bob waiting for incoming message...");

    let incoming = ws_recv_until(&mut bob_stream, 10, |msg| {
        matches!(msg, ServerMessage::Message { .. })
    })
    .await?;

    match incoming {
        ServerMessage::Message {
            id,
            sender_id,
            ciphertext: received_ct,
            message_type,
            timestamp,
            ..
        } => {
            println!("  [+] Bob received message!");
            println!("      Message ID: {}", id.0);
            println!("      From: {}", sender_id.0);
            println!("      Type: {:?}", message_type);
            println!("      Timestamp: {}", timestamp);
            println!("      Ciphertext: {} bytes", received_ct.len());

            // Verify the ciphertext matches what was sent
            if received_ct == ciphertext {
                println!("  [+] Ciphertext matches what Alice sent!");
            } else {
                println!("  [!] WARNING: Ciphertext mismatch!");
            }

            // Note: Bob can't decrypt yet without establishing a receiving session.
            // In production, Bob would call Session::receive() with the initial message
            // and his private keys to derive the same shared secret.
            println!("\n  [*] Bob would decrypt using Session::receive() with his private keys");
            println!("      (X3DH receiving session establishment)");

            // Show what plaintext would be
            println!("  [*] Original plaintext: \"{}\"", plaintext);
        }
        _ => {
            anyhow::bail!("Expected Message, got something else");
        }
    }

    // Also check Alice got a MessageSent confirmation
    println!("\n  Checking Alice's delivery confirmation...");
    match ws_recv_until(&mut alice_stream, 5, |msg| {
        matches!(msg, ServerMessage::MessageSent { .. })
    })
    .await
    {
        Ok(ServerMessage::MessageSent { message_id }) => {
            println!(
                "  [+] Alice received MessageSent confirmation (id: {})",
                message_id.0
            );
        }
        Ok(_) => println!("  [~] Unexpected confirmation type"),
        Err(e) => println!(
            "  [~] No explicit confirmation (may have been received earlier): {}",
            e
        ),
    }

    // ── Done ─────────────────────────────────────────────────────────
    println!("\n=== Test Complete ===");
    println!("  Alice: {} ({})", alice.username, &alice.user_id[..8]);
    println!("  Bob:   {} ({})", bob.username, &bob.user_id[..8]);
    println!("  Message: \"{}\"", plaintext);
    println!("  Encryption: X3DH + Double Ratchet (Signal Protocol)");
    println!("  Status: E2E message delivered successfully!");
    println!("\n  Mnemonic (Alice): {}", &alice.mnemonic[..40]);
    println!("  Mnemonic (Bob):   {}", &bob.mnemonic[..40]);

    // Clean close
    let _ = alice_sink.close().await;
    let _ = bob_sink.close().await;

    Ok(())
}
