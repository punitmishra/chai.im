//! Application state with typing indicators, read receipts, and auth.

use crate::auth;
use crate::config::Config;
use crate::network::client::Client;
use anyhow::Result;
use chai_common::{uuid, ConversationId, MessageId, UserId};
use chai_protocol::{ClientMessage, MessageType, ServerMessage};
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
        let ws_url = format!("{}?token={}", self.config.server_url, token);

        match Client::connect(&ws_url).await {
            Ok(client) => {
                self.client = Some(client);
                self.connected = true;
                self.status = "Connected ●".into();
            }
            Err(e) => {
                self.status = format!("Connection failed: {}", e);
            }
        }

        Ok(())
    }

    /// Disconnect from the server.
    pub fn disconnect(&mut self) {
        // Send typing stop if we were typing
        if self.is_typing {
            self.send_typing_stop();
        }
        self.client = None;
        self.connected = false;
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
                self.input.insert(self.cursor_position, c);
                self.cursor_position += 1;
                // Send typing indicator
                self.maybe_send_typing_start();
            }
            KeyCode::Backspace => {
                if self.cursor_position > 0 {
                    self.cursor_position -= 1;
                    self.input.remove(self.cursor_position);
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
                    self.cursor_position -= 1;
                }
            }
            KeyCode::Right => {
                if self.cursor_position < self.input.len() {
                    self.cursor_position += 1;
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
            }
            KeyCode::Enter => {
                self.execute_command();
                self.input_mode = InputMode::Normal;
                self.input.clear();
            }
            KeyCode::Char(c) => {
                self.input.insert(self.cursor_position, c);
                self.cursor_position += 1;
            }
            KeyCode::Backspace => {
                if self.cursor_position > 0 {
                    self.cursor_position -= 1;
                    self.input.remove(self.cursor_position);
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

            // For now, send as plaintext - TODO: encrypt with Signal Protocol
            let msg = ClientMessage::SendMessage {
                recipient_id: UserId(recipient_uuid),
                conversation_id: ConversationId(recipient_uuid),
                ciphertext: content.into_bytes(),
                message_type: MessageType::Normal,
            };

            let client = client.clone();
            tokio::spawn(async move {
                let _ = client.send(msg).await;
            });
        }
    }

    fn execute_command(&mut self) {
        let cmd = self.input.trim().to_string();
        match cmd.as_str() {
            "q" | "quit" => {
                // Will be handled by main loop
            }
            "connect" | "c" => {
                if self.config.is_authenticated() {
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
                let username = cmd.strip_prefix("chat ").unwrap().trim();
                if !username.is_empty() {
                    self.start_conversation(username.to_string());
                }
            }
            _ => {
                self.status = format!("Unknown: {} (try :help)", cmd);
            }
        }
    }

    /// Start a new conversation with a user.
    fn start_conversation(&mut self, username: String) {
        if let Some(idx) = self.conversations.iter().position(|c| c.name == username) {
            self.selected_conversation = idx;
            return;
        }

        let conv = Conversation {
            id: format!("conv_{}", username),
            name: username.clone(),
            last_message: None,
            unread_count: 0,
            online: false,
            typing: false,
        };

        self.conversations.push(conv);
        self.selected_conversation = self.conversations.len() - 1;
        self.status = format!("Chat with {}", username);
    }

    /// Process network events and auth.
    pub async fn tick(&mut self) -> Result<()> {
        // Handle auth if loading
        if self.auth_loading {
            self.perform_auth().await;
            return Ok(());
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
                // Auth succeeded
                self.user_id = self.config.user_id.clone();
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
                conversation_id,
                ciphertext,
                timestamp,
                ..
            } => {
                let content = String::from_utf8_lossy(&ciphertext).to_string();
                let conv_id = format!("conv_{}", conversation_id.0);
                let sender_name = sender_id.0.to_string();

                // Clear typing indicator for this sender
                if let Some(states) = self.typing_states.get_mut(&conv_id) {
                    states.retain(|s| s.user_id != sender_name);
                }

                // Find or create conversation
                let conv_exists = self.conversations.iter().any(|c| c.id == conv_id);
                if !conv_exists {
                    self.conversations.push(Conversation {
                        id: conv_id.clone(),
                        name: sender_name.clone(),
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
                    sender: sender_name,
                    content,
                    timestamp: format_timestamp(timestamp),
                    is_self: false,
                    status: MessageStatus::Delivered,
                });
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
                conversation_id,
                is_typing,
            } => {
                let conv_id = format!("conv_{}", conversation_id.0);
                let user_name = user_id.0.to_string();

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
                let user_name = user_id.0.to_string();
                let online = matches!(status, UserStatus::Active | UserStatus::Away);
                for conv in &mut self.conversations {
                    if conv.name == user_name {
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
