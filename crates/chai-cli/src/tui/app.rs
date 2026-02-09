//! Application state with typing indicators, read receipts, auth, and E2E encryption.

use crate::auth;
use crate::config::Config;
use crate::network::client::Client;
use anyhow::Result;
use chai_common::{uuid, ConversationId, MessageId, UserId};
use chai_crypto::session::{EncryptedMessage, PrekeyMessagePayload, Session};
use chai_crypto::x3dh::X3DHInitialMessage;
use chai_crypto::{IdentityKeyPair, OneTimePreKey, PreKeyBundle, SignedPreKey};
use chai_protocol::{ClientMessage, MessageType, PrekeyBundleData, ServerMessage};
use crossterm::event::{KeyCode, KeyEvent};
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Typing indicator timeout (5 seconds).
const TYPING_TIMEOUT: Duration = Duration::from_secs(5);
/// Debounce interval for sending typing indicators.
const TYPING_DEBOUNCE: Duration = Duration::from_secs(3);

/// Application screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Screen {
    /// Main chat screen.
    Chat,
    /// Welcome/login screen.
    Welcome,
    /// Register screen - entering username.
    Register,
    /// Mnemonic display screen (after registration).
    MnemonicDisplay(String),
    /// Login screen - entering username.
    Login,
    /// Mnemonic input screen (for login).
    MnemonicInput,
}

/// Input mode for the application.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    /// Normal mode (navigation).
    Normal,
    /// Editing mode (typing messages).
    Editing,
    /// Command mode (typing commands).
    Command,
}

/// Message delivery status.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageStatus {
    Sending,
    Sent,
    Delivered,
    Read,
}

impl MessageStatus {
    pub fn icon(&self) -> &'static str {
        match self {
            MessageStatus::Sending => "○",
            MessageStatus::Sent => "✓",
            MessageStatus::Delivered => "✓✓",
            MessageStatus::Read => "✓✓",
        }
    }
}

/// A chat message.
#[derive(Debug, Clone)]
pub struct Message {
    pub id: Option<String>,
    pub sender: String,
    pub content: String,
    pub timestamp: String,
    pub is_self: bool,
    pub status: MessageStatus,
}

/// A conversation in the sidebar.
#[derive(Debug, Clone)]
pub struct Conversation {
    pub id: String,
    pub name: String,
    pub last_message: Option<String>,
    pub unread_count: u32,
    pub online: bool,
    pub typing: bool,
}

/// Typing state for a user.
struct TypingState {
    user_id: String,
    started_at: Instant,
}

/// Application state.
pub struct App {
    /// Configuration.
    pub config: Config,
    /// Current screen.
    pub screen: Screen,
    /// Current input mode.
    pub input_mode: InputMode,
    /// Current input buffer.
    pub input: String,
    /// Cursor position in input.
    pub cursor_position: usize,
    /// List of conversations.
    pub conversations: Vec<Conversation>,
    /// Selected conversation index.
    pub selected_conversation: usize,
    /// Messages per conversation.
    pub conversation_messages: HashMap<String, Vec<Message>>,
    /// Scroll offset for messages.
    pub message_scroll: usize,
    /// Status message.
    pub status: String,
    /// Whether connected to server.
    pub connected: bool,
    /// WebSocket client (when connected).
    client: Option<Client>,
    /// Current user ID.
    pub user_id: Option<String>,
    /// Users currently typing in each conversation.
    typing_states: HashMap<String, Vec<TypingState>>,
    /// When we last sent a typing indicator.
    last_typing_sent: Option<Instant>,
    /// Whether we're currently in "typing" state.
    is_typing: bool,
    /// Username being entered for auth.
    pub auth_username: String,
    /// Mnemonic being entered for login.
    pub auth_mnemonic: String,
    /// Auth error message.
    pub auth_error: Option<String>,
    /// Auth is in progress.
    pub auth_loading: bool,
    /// Our identity keypair for crypto.
    identity: Option<IdentityKeyPair>,
    /// Our signed prekey for receiving sessions.
    signed_prekey: Option<SignedPreKey>,
    /// Our one-time prekeys.
    one_time_prekeys: Vec<OneTimePreKey>,
    /// Active encrypted sessions per peer (keyed by user_id string).
    sessions: HashMap<String, Session>,
    /// Pending prekey requests (peer_id -> message to send after bundle received).
    pending_prekey_requests: HashMap<String, String>,
    /// Pending X3DH initial messages (peer_id -> initial_message, stored until first send).
    pending_initial_messages: HashMap<String, X3DHInitialMessage>,
    /// Next one-time prekey ID.
    next_prekey_id: u32,
    /// Flag: user requested connect (handled in async tick).
    wants_connect: bool,
    /// Flag: user requested a chat with a username (needs async lookup).
    pending_chat_lookup: Option<String>,
    /// Flag: user requested quit.
    pub should_quit: bool,
}

impl App {
    pub fn new(config: Config) -> Self {
        let user_id = config.user_id.clone();
        let is_authenticated = config.is_authenticated();

        let (screen, status) = if is_authenticated {
            (Screen::Chat, "Ready to connect. Press ':c' to connect".into())
        } else {
            (Screen::Welcome, "Welcome to Chai! Press 'r' to register or 'l' to login".into())
        };

        // Initialize crypto from stored identity
        let identity = config.get_identity();
        let (signed_prekey, one_time_prekeys) = if let Some(ref id) = identity {
            let spk = SignedPreKey::generate(1, id);
            let mut otks = Vec::new();
            for i in 1..=10 {
                otks.push(OneTimePreKey::generate(i));
            }
            (Some(spk), otks)
        } else {
            (None, Vec::new())
        };

        Self {
            config,
            screen,
            input_mode: InputMode::Normal,
            input: String::new(),
            cursor_position: 0,
            conversations: Vec::new(),
            selected_conversation: 0,
            conversation_messages: HashMap::new(),
            message_scroll: 0,
            status,
            connected: false,
            client: None,
            user_id,
            typing_states: HashMap::new(),
            last_typing_sent: None,
            is_typing: false,
            auth_username: String::new(),
            auth_mnemonic: String::new(),
            auth_error: None,
            auth_loading: false,
            identity,
            signed_prekey,
            one_time_prekeys,
            sessions: HashMap::new(),
            pending_prekey_requests: HashMap::new(),
            pending_initial_messages: HashMap::new(),
            next_prekey_id: 11, // Start after initial 10
            wants_connect: false,
            pending_chat_lookup: None,
            should_quit: false,
        }
    }

    /// Get messages for the current conversation.
    pub fn messages(&self) -> &[Message] {
        if let Some(conv) = self.conversations.get(self.selected_conversation) {
            if let Some(msgs) = self.conversation_messages.get(&conv.id) {
                return msgs;
            }
        }
        &[]
    }

    /// Get typing users for the current conversation.
    pub fn typing_users(&self) -> Vec<&str> {
        if let Some(conv) = self.conversations.get(self.selected_conversation) {
            if let Some(states) = self.typing_states.get(&conv.id) {
                return states.iter().map(|s| s.user_id.as_str()).collect();
            }
        }
        Vec::new()
    }

    /// Check if anyone is typing in the current conversation.
    pub fn is_someone_typing(&self) -> bool {
        !self.typing_users().is_empty()
    }

    /// Connect to the server.
    pub async fn connect(&mut self) -> Result<()> {
        let token = match &self.config.session_token {
            Some(t) => t.clone(),
            None => {
                self.status = "No session token - use ':login' first".into();
                return Ok(());
            }
        };

        self.status = "Connecting...".into();

        // Build WebSocket URL with token
        let ws_url = format!("{}?token={}", self.config.ws_url, token);

        match Client::connect(&ws_url).await {
            Ok(client) => {
                self.client = Some(client.clone());
                self.connected = true;
                self.status = "Connected ●".into();

                // Upload prekey bundle after connecting
                self.upload_prekeys(&client).await;
            }
            Err(e) => {
                self.status = format!("Connection failed: {}", e);
            }
        }

        Ok(())
    }

    /// Upload prekey bundle to the server.
    async fn upload_prekeys(&mut self, client: &Client) {
        let Some(ref identity) = self.identity else {
            return;
        };
        let Some(ref spk) = self.signed_prekey else {
            return;
        };

        // Create prekey bundle data for protocol
        let bundle = PrekeyBundleData {
            identity_key: identity.public_key().to_bytes().to_vec(),
            signed_prekey: spk.public_key().to_bytes().to_vec(),
            signed_prekey_signature: spk.signature.clone(),
            signed_prekey_id: spk.id,
            one_time_prekey: self.one_time_prekeys.first().map(|k| k.public_key().to_bytes().to_vec()),
            one_time_prekey_id: self.one_time_prekeys.first().map(|k| k.id),
        };

        let msg = ClientMessage::UploadPrekeyBundle { bundle };
        let _ = client.send(msg).await;

        // Also upload batch of one-time prekeys
        let otks: Vec<chai_protocol::OneTimePrekey> = self
            .one_time_prekeys
            .iter()
            .map(|k| chai_protocol::OneTimePrekey {
                id: k.id,
                key: k.public_key().to_bytes().to_vec(),
            })
            .collect();

        if !otks.is_empty() {
            let msg = ClientMessage::UploadOneTimePrekeys { prekeys: otks };
            let _ = client.send(msg).await;
        }

        self.status = "Connected ● (keys uploaded)".into();
    }

    /// Disconnect from the server.
    pub fn disconnect(&mut self) {
        // Send typing stop if we were typing
        if self.is_typing {
            self.send_typing_stop();
        }
        self.client = None;
        self.connected = false;
        // Clear crypto sessions — they're tied to the old connection's keys
        self.sessions.clear();
        self.pending_prekey_requests.clear();
        self.pending_initial_messages.clear();
        self.status = "Disconnected".into();
    }

    /// Handle a key event.
    pub fn handle_key(&mut self, key: KeyEvent) {
        // Route based on current screen
        match &self.screen {
            Screen::Welcome => self.handle_welcome_key(key),
            Screen::Register => self.handle_register_key(key),
            Screen::Login => self.handle_login_key(key),
            Screen::MnemonicDisplay(_) => self.handle_mnemonic_display_key(key),
            Screen::MnemonicInput => self.handle_mnemonic_input_key(key),
            Screen::Chat => {
                match self.input_mode {
                    InputMode::Normal => self.handle_normal_mode(key),
                    InputMode::Editing => self.handle_editing_mode(key),
                    InputMode::Command => self.handle_command_mode(key),
                }
            }
        }
    }

    /// Handle key events on welcome screen.
    fn handle_welcome_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('r') | KeyCode::Char('R') => {
                self.screen = Screen::Register;
                self.auth_username.clear();
                self.auth_error = None;
                self.status = "Enter a username".into();
            }
            KeyCode::Char('l') | KeyCode::Char('L') => {
                self.screen = Screen::Login;
                self.auth_username.clear();
                self.auth_error = None;
                self.status = "Enter your username".into();
            }
            _ => {}
        }
    }

    /// Handle key events on register screen.
    fn handle_register_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.screen = Screen::Welcome;
                self.auth_username.clear();
                self.auth_error = None;
            }
            KeyCode::Enter => {
                if !self.auth_username.is_empty() {
                    // Generate mnemonic and proceed
                    let mnemonic = auth::new_mnemonic();
                    self.screen = Screen::MnemonicDisplay(mnemonic);
                    self.status = "Write down your recovery phrase! Press Enter when ready.".into();
                }
            }
            KeyCode::Char(c) => {
                if c.is_ascii_alphanumeric() || c == '_' {
                    self.auth_username.push(c);
                    self.auth_error = None;
                }
            }
            KeyCode::Backspace => {
                self.auth_username.pop();
            }
            _ => {}
        }
    }

    /// Handle key events on login screen.
    fn handle_login_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.screen = Screen::Welcome;
                self.auth_username.clear();
                self.auth_error = None;
            }
            KeyCode::Enter => {
                if !self.auth_username.is_empty() {
                    self.screen = Screen::MnemonicInput;
                    self.auth_mnemonic.clear();
                    self.status = "Enter your 24-word recovery phrase".into();
                }
            }
            KeyCode::Char(c) => {
                if c.is_ascii_alphanumeric() || c == '_' {
                    self.auth_username.push(c);
                    self.auth_error = None;
                }
            }
            KeyCode::Backspace => {
                self.auth_username.pop();
            }
            _ => {}
        }
    }

    /// Handle key events on mnemonic display screen.
    fn handle_mnemonic_display_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.screen = Screen::Register;
                self.status = "Enter a username".into();
            }
            KeyCode::Enter => {
                // User confirmed they saved the mnemonic
                if let Screen::MnemonicDisplay(mnemonic) = self.screen.clone() {
                    self.auth_mnemonic = mnemonic;
                    self.auth_loading = true;
                    self.status = "Registering...".into();
                    // Auth will be performed in tick()
                }
            }
            _ => {}
        }
    }

    /// Handle key events on mnemonic input screen.
    fn handle_mnemonic_input_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.screen = Screen::Login;
                self.auth_mnemonic.clear();
                self.auth_error = None;
                self.status = "Enter your username".into();
            }
            KeyCode::Enter => {
                if !self.auth_mnemonic.is_empty() {
                    // Validate mnemonic
                    if auth::is_valid_mnemonic(&self.auth_mnemonic) {
                        self.auth_loading = true;
                        self.status = "Logging in...".into();
                        // Auth will be performed in tick()
                    } else {
                        self.auth_error = Some("Invalid recovery phrase".into());
                    }
                }
            }
            KeyCode::Char(c) => {
                if c.is_ascii_alphabetic() || c == ' ' {
                    self.auth_mnemonic.push(c.to_ascii_lowercase());
                    self.auth_error = None;
                }
            }
            KeyCode::Backspace => {
                self.auth_mnemonic.pop();
            }
            _ => {}
        }
    }

    fn handle_normal_mode(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('i') => {
                self.input_mode = InputMode::Editing;
            }
            KeyCode::Char(':') => {
                self.input_mode = InputMode::Command;
                self.input.clear();
                self.cursor_position = 0;
            }
            KeyCode::Char('j') | KeyCode::Down => {
                if self.selected_conversation < self.conversations.len().saturating_sub(1) {
                    self.selected_conversation += 1;
                    self.mark_conversation_read();
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if self.selected_conversation > 0 {
                    self.selected_conversation -= 1;
                    self.mark_conversation_read();
                }
            }
            KeyCode::Char('g') => {
                self.selected_conversation = 0;
                self.mark_conversation_read();
            }
            KeyCode::Char('G') => {
                self.selected_conversation = self.conversations.len().saturating_sub(1);
                self.mark_conversation_read();
            }
            KeyCode::Enter => {
                // Mark current conversation as read on enter
                self.mark_conversation_read();
            }
            _ => {}
        }
    }

    fn handle_editing_mode(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.input_mode = InputMode::Normal;
                self.cursor_position = self.input.len();
                // Send typing stop when exiting edit mode
                if self.is_typing {
                    self.send_typing_stop();
                }
            }
            KeyCode::Enter => {
                if !self.input.is_empty() {
                    // Send typing stop before sending message
                    if self.is_typing {
                        self.send_typing_stop();
                    }
                    self.send_message();
                }
            }
            KeyCode::Char(c) => {
                // Clamp cursor to valid position
                let pos = self.cursor_position.min(self.input.len());
                self.input.insert(pos, c);
                self.cursor_position = pos + c.len_utf8();
                // Send typing indicator
                self.maybe_send_typing_start();
            }
            KeyCode::Backspace => {
                if self.cursor_position > 0 {
                    // Find previous char boundary
                    let prev = self.input[..self.cursor_position]
                        .char_indices()
                        .next_back()
                        .map(|(i, _)| i)
                        .unwrap_or(0);
                    self.input.remove(prev);
                    self.cursor_position = prev;
                }
                // If input is now empty, send typing stop
                if self.input.is_empty() && self.is_typing {
                    self.send_typing_stop();
                }
            }
            KeyCode::Delete => {
                if self.cursor_position < self.input.len() {
                    self.input.remove(self.cursor_position);
                }
            }
            KeyCode::Left => {
                if self.cursor_position > 0 {
                    // Move to previous char boundary
                    self.cursor_position = self.input[..self.cursor_position]
                        .char_indices()
                        .next_back()
                        .map(|(i, _)| i)
                        .unwrap_or(0);
                }
            }
            KeyCode::Right => {
                if self.cursor_position < self.input.len() {
                    // Move to next char boundary
                    self.cursor_position = self.input[self.cursor_position..]
                        .char_indices()
                        .nth(1)
                        .map(|(i, _)| self.cursor_position + i)
                        .unwrap_or(self.input.len());
                }
            }
            KeyCode::Home => {
                self.cursor_position = 0;
            }
            KeyCode::End => {
                self.cursor_position = self.input.len();
            }
            _ => {}
        }
    }

    fn handle_command_mode(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.input_mode = InputMode::Normal;
                self.input.clear();
                self.cursor_position = 0;
            }
            KeyCode::Enter => {
                self.execute_command();
                self.input_mode = InputMode::Normal;
                self.input.clear();
                self.cursor_position = 0;
            }
            KeyCode::Char(c) => {
                let pos = self.cursor_position.min(self.input.len());
                self.input.insert(pos, c);
                self.cursor_position = pos + c.len_utf8();
            }
            KeyCode::Backspace => {
                if self.cursor_position > 0 {
                    let prev = self.input[..self.cursor_position]
                        .char_indices()
                        .next_back()
                        .map(|(i, _)| i)
                        .unwrap_or(0);
                    self.input.remove(prev);
                    self.cursor_position = prev;
                }
            }
            _ => {}
        }
    }

    /// Maybe send typing start indicator (debounced).
    fn maybe_send_typing_start(&mut self) {
        let should_send = match self.last_typing_sent {
            None => true,
            Some(last) => last.elapsed() >= TYPING_DEBOUNCE,
        };

        if should_send && self.connected {
            self.send_typing_start();
        }
    }

    /// Send typing start indicator.
    fn send_typing_start(&mut self) {
        if let Some(conv) = self.conversations.get(self.selected_conversation) {
            let recipient_uuid = conv
                .id
                .strip_prefix("conv_")
                .and_then(|s| uuid::Uuid::parse_str(s).ok())
                .unwrap_or_else(uuid::Uuid::nil);

            let msg = ClientMessage::TypingStart {
                recipient_id: UserId(recipient_uuid),
                conversation_id: ConversationId(recipient_uuid),
            };

            if let Some(client) = &self.client {
                let client = client.clone();
                tokio::spawn(async move {
                    let _ = client.send(msg).await;
                });
            }

            self.last_typing_sent = Some(Instant::now());
            self.is_typing = true;
        }
    }

    /// Send typing stop indicator.
    fn send_typing_stop(&mut self) {
        if let Some(conv) = self.conversations.get(self.selected_conversation) {
            let recipient_uuid = conv
                .id
                .strip_prefix("conv_")
                .and_then(|s| uuid::Uuid::parse_str(s).ok())
                .unwrap_or_else(uuid::Uuid::nil);

            let msg = ClientMessage::TypingStop {
                recipient_id: UserId(recipient_uuid),
                conversation_id: ConversationId(recipient_uuid),
            };

            if let Some(client) = &self.client {
                let client = client.clone();
                tokio::spawn(async move {
                    let _ = client.send(msg).await;
                });
            }

            self.is_typing = false;
            self.last_typing_sent = None;
        }
    }

    /// Mark current conversation as read.
    fn mark_conversation_read(&mut self) {
        if let Some(conv) = self.conversations.get_mut(self.selected_conversation) {
            if conv.unread_count > 0 {
                conv.unread_count = 0;

                // Send read receipts
                let recipient_uuid = conv
                    .id
                    .strip_prefix("conv_")
                    .and_then(|s| uuid::Uuid::parse_str(s).ok())
                    .unwrap_or_else(uuid::Uuid::nil);

                // Get unread message IDs
                let message_ids: Vec<MessageId> = self
                    .conversation_messages
                    .get(&conv.id)
                    .map(|msgs| {
                        msgs.iter()
                            .filter(|m| !m.is_self)
                            .filter_map(|m| {
                                m.id.as_ref()
                                    .and_then(|id| uuid::Uuid::parse_str(id).ok())
                                    .map(MessageId)
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                if !message_ids.is_empty() {
                    let msg = ClientMessage::MarkRead {
                        conversation_id: ConversationId(recipient_uuid),
                        message_ids,
                    };

                    if let Some(client) = &self.client {
                        let client = client.clone();
                        tokio::spawn(async move {
                            let _ = client.send(msg).await;
                        });
                    }
                }
            }
        }
    }

    fn send_message(&mut self) {
        let content = std::mem::take(&mut self.input);
        self.cursor_position = 0;

        if content.is_empty() {
            return;
        }

        // Get current conversation
        let conv = match self.conversations.get(self.selected_conversation) {
            Some(c) => c.clone(),
            None => {
                self.status = "No conversation selected".into();
                return;
            }
        };

        // Generate message ID
        let msg_id = uuid::Uuid::new_v4().to_string();

        // Add message to local list
        let messages = self
            .conversation_messages
            .entry(conv.id.clone())
            .or_default();
        messages.push(Message {
            id: Some(msg_id.clone()),
            sender: "You".into(),
            content: content.clone(),
            timestamp: chrono_lite_timestamp(),
            is_self: true,
            status: MessageStatus::Sending,
        });

        // Send via WebSocket if connected
        if let Some(client) = &self.client {
            let recipient_uuid = conv
                .id
                .strip_prefix("conv_")
                .and_then(|s| uuid::Uuid::parse_str(s).ok())
                .unwrap_or_else(uuid::Uuid::nil);
            let peer_id = recipient_uuid.to_string();

            // Check if we have a session with this peer
            if let Some(session) = self.sessions.get_mut(&peer_id) {
                // Encrypt with existing session
                match session.encrypt(content.as_bytes()) {
                    Ok(encrypted) => {
                        match encrypted.to_bytes() {
                            Ok(ciphertext) => {
                                let msg = ClientMessage::SendMessage {
                                    recipient_id: UserId(recipient_uuid),
                                    conversation_id: ConversationId(recipient_uuid),
                                    ciphertext,
                                    message_type: MessageType::Normal,
                                };
                                let client = client.clone();
                                tokio::spawn(async move {
                                    let _ = client.send(msg).await;
                                });
                                self.status = "Secure message sent".into();
                            }
                            Err(e) => {
                                self.status = format!("Serialization failed: {:?}", e);
                            }
                        }
                    }
                    Err(e) => {
                        self.status = format!("Encryption failed: {:?}", e);
                    }
                }
            } else {
                // No session - request prekey bundle and queue message
                self.pending_prekey_requests
                    .insert(peer_id.clone(), content);
                self.status = "Requesting keys...".into();

                let msg = ClientMessage::GetPrekeyBundle {
                    user_id: UserId(recipient_uuid),
                };
                let client = client.clone();
                tokio::spawn(async move {
                    let _ = client.send(msg).await;
                });
            }
        } else {
            self.status = "Not connected".into();
        }
    }

    /// Send a message using an initial X3DH handshake.
    fn send_initial_message(&mut self, peer_id: &str, content: &str, recipient_uuid: uuid::Uuid) {
        let Some(session) = self.sessions.get_mut(peer_id) else {
            self.status = "Session not found".into();
            return;
        };

        // Get the stored X3DH initial message
        let Some(initial_message) = self.pending_initial_messages.remove(peer_id) else {
            self.status = "No X3DH initial message stored".into();
            return;
        };

        match session.encrypt(content.as_bytes()) {
            Ok(encrypted_message) => {
                // Bundle the X3DH handshake + encrypted message together
                let payload = PrekeyMessagePayload {
                    initial_message,
                    encrypted_message,
                };
                match payload.to_bytes() {
                    Ok(ciphertext) => {
                        let msg = ClientMessage::SendMessage {
                            recipient_id: UserId(recipient_uuid),
                            conversation_id: ConversationId(recipient_uuid),
                            ciphertext,
                            message_type: MessageType::Prekey,
                        };
                        if let Some(client) = &self.client {
                            let client = client.clone();
                            tokio::spawn(async move {
                                let _ = client.send(msg).await;
                            });
                        }
                        self.status = "Secure message sent".into();
                    }
                    Err(e) => {
                        self.status = format!("Serialization failed: {:?}", e);
                    }
                }
            }
            Err(e) => {
                self.status = format!("Encryption failed: {:?}", e);
            }
        }
    }

    fn execute_command(&mut self) {
        let cmd = self.input.trim().to_string();
        match cmd.as_str() {
            "q" | "quit" => {
                self.should_quit = true;
            }
            "connect" | "c" => {
                if self.config.is_authenticated() {
                    self.wants_connect = true;
                    self.status = "Connecting...".into();
                } else {
                    self.status = "Not logged in. Use :logout to switch accounts".into();
                }
            }
            "disconnect" | "dc" => {
                self.disconnect();
            }
            "logout" => {
                self.disconnect();
                self.config.logout();
                let _ = self.config.save();
                self.screen = Screen::Welcome;
                self.status = "Logged out. Press 'r' to register or 'l' to login".into();
            }
            "help" | "h" => {
                self.status =
                    ":c connect | :dc disconnect | :chat <user> | :logout | :q quit".into();
            }
            _ if cmd.starts_with("chat ") => {
                let target = cmd.strip_prefix("chat ").unwrap().trim();
                if !target.is_empty() {
                    // If it looks like a UUID, use it directly
                    if uuid::Uuid::parse_str(target).is_ok() {
                        self.start_conversation_with_id(target.to_string(), target.to_string());
                    } else {
                        // Need to resolve username to user_id
                        self.pending_chat_lookup = Some(target.to_string());
                        self.status = format!("Looking up user '{}'...", target);
                    }
                }
            }
            _ => {
                self.status = format!("Unknown: {} (try :help)", cmd);
            }
        }
    }

    /// Start a new conversation with a user by user_id.
    fn start_conversation_with_id(&mut self, user_id: String, display_name: String) {
        // Check if conversation already exists for this user_id
        let conv_id = format!("conv_{}", user_id);
        if let Some(idx) = self.conversations.iter().position(|c| c.id == conv_id) {
            self.selected_conversation = idx;
            return;
        }

        let conv = Conversation {
            id: conv_id,
            name: display_name.clone(),
            last_message: None,
            unread_count: 0,
            online: false,
            typing: false,
        };

        self.conversations.push(conv);
        self.selected_conversation = self.conversations.len() - 1;
        self.status = format!("Chat with {}", display_name);

        // Subscribe to presence for this user
        if let Ok(user_uuid) = uuid::Uuid::parse_str(&user_id) {
            if let Some(client) = &self.client {
                let msg = ClientMessage::SubscribePresence {
                    user_ids: vec![UserId(user_uuid)],
                };
                let client = client.clone();
                tokio::spawn(async move {
                    let _ = client.send(msg).await;
                });
            }
        }
    }

    /// Process network events and auth.
    pub async fn tick(&mut self) -> Result<()> {
        // Handle auth if loading
        if self.auth_loading {
            self.perform_auth().await;
            return Ok(());
        }

        // Handle connect request
        if self.wants_connect {
            self.wants_connect = false;
            self.connect().await?;
        }

        // Handle pending username lookup
        if let Some(username) = self.pending_chat_lookup.take() {
            self.lookup_and_start_chat(&username).await;
        }

        // Clean up expired typing indicators
        self.cleanup_typing_indicators();

        // Process incoming messages from WebSocket
        let messages: Vec<_> = if let Some(client) = &self.client {
            let mut msgs = Vec::new();
            while let Some(msg) = client.try_recv() {
                msgs.push(msg);
            }
            msgs
        } else {
            Vec::new()
        };

        for msg in messages {
            self.handle_server_message(msg);
        }
        Ok(())
    }

    /// Look up a username via the server API and start a conversation.
    async fn lookup_and_start_chat(&mut self, username: &str) {
        let Some(ref token) = self.config.session_token else {
            self.status = "Not authenticated - connect first".into();
            return;
        };

        let url = format!("{}/users/search?q={}&limit=1", self.config.server_url, username);
        let client = reqwest::Client::new();
        match client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                #[derive(serde::Deserialize)]
                struct SearchResult {
                    users: Vec<UserInfo>,
                }
                #[derive(serde::Deserialize)]
                struct UserInfo {
                    id: String,
                    username: String,
                }

                match resp.json::<SearchResult>().await {
                    Ok(result) => {
                        // Find exact match
                        if let Some(user) = result
                            .users
                            .iter()
                            .find(|u| u.username == username)
                            .or_else(|| result.users.first())
                        {
                            self.start_conversation_with_id(
                                user.id.clone(),
                                user.username.clone(),
                            );
                        } else {
                            self.status = format!("User '{}' not found", username);
                        }
                    }
                    Err(e) => {
                        self.status = format!("Search failed: {}", e);
                    }
                }
            }
            Ok(resp) => {
                self.status = format!("Search failed: HTTP {}", resp.status());
            }
            Err(e) => {
                self.status = format!("Search failed: {}", e);
            }
        }
    }

    /// Perform auth operation.
    async fn perform_auth(&mut self) {
        let is_register = matches!(self.screen, Screen::MnemonicDisplay(_));

        let result = if is_register {
            auth::register_flow(
                &mut self.config,
                &self.auth_username,
                &self.auth_mnemonic,
            )
            .await
        } else {
            auth::login_flow(
                &mut self.config,
                &self.auth_username,
                &self.auth_mnemonic,
            )
            .await
        };

        self.auth_loading = false;

        match result {
            Ok(()) => {
                // Auth succeeded - reinitialize crypto state
                self.user_id = self.config.user_id.clone();
                self.identity = self.config.get_identity();
                if let Some(ref id) = self.identity {
                    self.signed_prekey = Some(SignedPreKey::generate(1, id));
                    self.one_time_prekeys.clear();
                    for i in 1..=10 {
                        self.one_time_prekeys.push(OneTimePreKey::generate(i));
                    }
                    self.next_prekey_id = 11;
                }
                self.sessions.clear();
                self.pending_prekey_requests.clear();
                self.pending_initial_messages.clear();

                self.screen = Screen::Chat;
                self.auth_username.clear();
                self.auth_mnemonic.clear();
                self.auth_error = None;
                self.status = format!(
                    "Welcome, {}! Press ':c' to connect",
                    self.config.username.as_deref().unwrap_or("user")
                );
            }
            Err(e) => {
                // Auth failed
                self.auth_error = Some(e.to_string());
                self.status = "Authentication failed".into();
                // Go back to appropriate screen
                if is_register {
                    self.screen = Screen::Register;
                } else {
                    self.screen = Screen::MnemonicInput;
                }
            }
        }
    }

    /// Clean up expired typing indicators.
    fn cleanup_typing_indicators(&mut self) {
        for (_conv_id, states) in self.typing_states.iter_mut() {
            states.retain(|s| s.started_at.elapsed() < TYPING_TIMEOUT);
        }

        // Update conversation typing status
        for conv in &mut self.conversations {
            conv.typing = self
                .typing_states
                .get(&conv.id)
                .map(|s| !s.is_empty())
                .unwrap_or(false);
        }
    }

    /// Handle incoming server message.
    fn handle_server_message(&mut self, msg: ServerMessage) {
        match msg {
            ServerMessage::Message {
                id,
                sender_id,
                conversation_id: _,
                ciphertext,
                message_type,
                timestamp,
            } => {
                // Use sender_id as conversation key (1:1 chats)
                let peer_id = sender_id.0.to_string();
                let conv_id = format!("conv_{}", peer_id);

                // Try to decrypt the message
                let content = self.decrypt_message(&peer_id, &ciphertext, message_type);

                // Clear typing indicator for this sender
                if let Some(states) = self.typing_states.get_mut(&conv_id) {
                    states.retain(|s| s.user_id != peer_id);
                }

                // Find or create conversation
                let conv_exists = self.conversations.iter().any(|c| c.id == conv_id);
                if !conv_exists {
                    self.conversations.push(Conversation {
                        id: conv_id.clone(),
                        name: peer_id.clone(), // Will be UUID until we resolve username
                        last_message: Some(content.clone()),
                        unread_count: 1,
                        online: true,
                        typing: false,
                    });
                } else {
                    for conv in &mut self.conversations {
                        if conv.id == conv_id {
                            conv.last_message = Some(content.clone());
                            conv.unread_count += 1;
                            conv.typing = false;
                        }
                    }
                }

                // Add message
                let messages = self.conversation_messages.entry(conv_id).or_default();
                messages.push(Message {
                    id: Some(id.0.to_string()),
                    sender: peer_id,
                    content,
                    timestamp: format_timestamp(timestamp),
                    is_self: false,
                    status: MessageStatus::Delivered,
                });
            }
            ServerMessage::PrekeyBundle { user_id, bundle } => {
                self.handle_prekey_bundle(user_id, bundle);
            }
            ServerMessage::MessageSent { message_id, .. } => {
                // Update message status to Sent
                self.update_message_status(&message_id.0.to_string(), MessageStatus::Sent);
            }
            ServerMessage::MessageDelivered { message_id, .. } => {
                self.update_message_status(&message_id.0.to_string(), MessageStatus::Delivered);
            }
            ServerMessage::MessageRead { message_id, .. } => {
                self.update_message_status(&message_id.0.to_string(), MessageStatus::Read);
            }
            ServerMessage::TypingIndicator {
                user_id,
                conversation_id: _,
                is_typing,
            } => {
                let peer_id = user_id.0.to_string();
                let conv_id = format!("conv_{}", peer_id);
                let user_name = peer_id;

                if is_typing {
                    // Add/refresh typing state
                    let states = self.typing_states.entry(conv_id.clone()).or_default();
                    states.retain(|s| s.user_id != user_name);
                    states.push(TypingState {
                        user_id: user_name,
                        started_at: Instant::now(),
                    });

                    // Update conversation
                    for conv in &mut self.conversations {
                        if conv.id == conv_id {
                            conv.typing = true;
                        }
                    }
                } else {
                    // Remove typing state
                    if let Some(states) = self.typing_states.get_mut(&conv_id) {
                        states.retain(|s| s.user_id != user_name);
                    }

                    // Update conversation
                    for conv in &mut self.conversations {
                        if conv.id == conv_id {
                            conv.typing = self
                                .typing_states
                                .get(&conv_id)
                                .map(|s| !s.is_empty())
                                .unwrap_or(false);
                        }
                    }
                }
            }
            ServerMessage::Error { message, .. } => {
                self.status = format!("Error: {}", message);
            }
            ServerMessage::PresenceUpdate {
                user_id, status, ..
            } => {
                use chai_protocol::UserStatus;
                let peer_id = user_id.0.to_string();
                let conv_id = format!("conv_{}", peer_id);
                let online = matches!(status, UserStatus::Active | UserStatus::Away);
                for conv in &mut self.conversations {
                    if conv.id == conv_id {
                        conv.online = online;
                    }
                }
            }
            _ => {}
        }
    }

    /// Update a message's delivery status.
    fn update_message_status(&mut self, msg_id: &str, status: MessageStatus) {
        for messages in self.conversation_messages.values_mut() {
            for msg in messages.iter_mut() {
                if msg.id.as_deref() == Some(msg_id) {
                    msg.status = status;
                    return;
                }
            }
        }
    }

    /// Decrypt an incoming message.
    fn decrypt_message(
        &mut self,
        peer_id: &str,
        ciphertext: &[u8],
        message_type: MessageType,
    ) -> String {
        // Handle initial prekey message (X3DH handshake)
        if message_type == MessageType::Prekey {
            if let Ok(payload) = PrekeyMessagePayload::from_bytes(ciphertext) {
                // Establish session from the X3DH initial message
                if let (Some(ref identity), Some(ref spk)) =
                    (self.identity.clone(), self.signed_prekey.clone())
                {
                    match Session::receive(
                        &identity,
                        &spk,
                        &mut self.one_time_prekeys,
                        peer_id.to_string(),
                        &payload.initial_message,
                    ) {
                        Ok(mut session) => {
                            match session.decrypt(&payload.encrypted_message) {
                                Ok(plaintext) => {
                                    self.sessions.insert(peer_id.to_string(), session);
                                    self.status = "Secure session established".into();
                                    return String::from_utf8_lossy(&plaintext).to_string();
                                }
                                Err(e) => {
                                    self.status =
                                        format!("Decrypt failed (prekey): {:?}", e);
                                }
                            }
                        }
                        Err(e) => {
                            self.status = format!("Session receive failed: {:?}", e);
                        }
                    }
                }
            }
        }

        // Try to decrypt with existing session (Normal messages)
        if let Some(session) = self.sessions.get_mut(peer_id) {
            if let Ok(encrypted) = EncryptedMessage::from_bytes(ciphertext) {
                if let Ok(plaintext) = session.decrypt(&encrypted) {
                    return String::from_utf8_lossy(&plaintext).to_string();
                }
            }
        }

        // Fallback: try as valid UTF-8 plaintext, otherwise show placeholder
        match String::from_utf8(ciphertext.to_vec()) {
            Ok(s) if s.chars().all(|c| !c.is_control() || c == '\n') => s,
            _ => "[encrypted message]".to_string(),
        }
    }

    /// Handle received prekey bundle and initialize session.
    fn handle_prekey_bundle(&mut self, user_id: UserId, bundle: Option<PrekeyBundleData>) {
        let peer_id = user_id.0.to_string();

        let Some(bundle_data) = bundle else {
            self.status = format!("No prekey bundle available for user");
            self.pending_prekey_requests.remove(&peer_id);
            return;
        };

        let Some(ref identity) = self.identity else {
            self.status = "No identity key available".into();
            return;
        };

        // Convert bundle data to PreKeyBundle
        match self.create_prekey_bundle(&bundle_data) {
            Ok(prekey_bundle) => {
                // Initialize session with X3DH
                match Session::initiate(identity, peer_id.clone(), &prekey_bundle) {
                    Ok((session, initial_message)) => {
                        self.sessions.insert(peer_id.clone(), session);
                        self.pending_initial_messages
                            .insert(peer_id.clone(), initial_message);
                        self.status = "Secure channel established".into();

                        // Send any pending message
                        if let Some(content) = self.pending_prekey_requests.remove(&peer_id) {
                            let recipient_uuid =
                                uuid::Uuid::parse_str(&peer_id).unwrap_or_else(|_| uuid::Uuid::nil());
                            self.send_initial_message(&peer_id, &content, recipient_uuid);
                        }
                    }
                    Err(e) => {
                        self.status = format!("Session init failed: {:?}", e);
                        self.pending_prekey_requests.remove(&peer_id);
                    }
                }
            }
            Err(e) => {
                self.status = format!("Invalid prekey bundle: {}", e);
                self.pending_prekey_requests.remove(&peer_id);
            }
        }
    }

    /// Convert protocol bundle data to crypto PreKeyBundle.
    fn create_prekey_bundle(&self, data: &PrekeyBundleData) -> Result<PreKeyBundle> {
        use chai_crypto::keys::IdentityPublicKey;

        // Parse identity key (Ed25519)
        let identity_bytes: [u8; 32] = data
            .identity_key
            .clone()
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid identity key length"))?;
        let identity_key = IdentityPublicKey::from_bytes(&identity_bytes)
            .map_err(|e| anyhow::anyhow!("Invalid identity key: {:?}", e))?;

        // Parse signed prekey (X25519) - already [u8; 32]
        let signed_prekey: [u8; 32] = data
            .signed_prekey
            .clone()
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid signed prekey length"))?;

        // Parse optional one-time prekey
        let one_time_prekey: Option<[u8; 32]> = if let Some(ref otk_bytes) = data.one_time_prekey {
            Some(
                otk_bytes
                    .clone()
                    .try_into()
                    .map_err(|_| anyhow::anyhow!("Invalid one-time prekey length"))?,
            )
        } else {
            None
        };

        Ok(PreKeyBundle {
            identity_key,
            signed_prekey,
            signed_prekey_signature: data.signed_prekey_signature.clone(),
            signed_prekey_id: data.signed_prekey_id,
            one_time_prekey,
            one_time_prekey_id: data.one_time_prekey_id,
        })
    }
}

/// Simple timestamp formatting.
fn chrono_lite_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let hours = (secs % 86400) / 3600;
    let mins = (secs % 3600) / 60;
    format!("{:02}:{:02}", hours, mins)
}

/// Format a Unix timestamp.
fn format_timestamp(ts: i64) -> String {
    let hours = (ts % 86400) / 3600;
    let mins = (ts % 3600) / 60;
    format!("{:02}:{:02}", hours, mins)
}
