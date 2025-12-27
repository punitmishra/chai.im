//! Application state.

use crate::config::Config;
use crate::network::client::Client;
use anyhow::Result;
use chai_common::{uuid, ConversationId, UserId};
use chai_protocol::{ClientMessage, MessageType, ServerMessage};
use crossterm::event::{KeyCode, KeyEvent};
use std::collections::HashMap;

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

/// A chat message.
#[derive(Debug, Clone)]
pub struct Message {
    pub sender: String,
    pub content: String,
    pub timestamp: String,
    pub is_self: bool,
}

/// A conversation in the sidebar.
#[derive(Debug, Clone)]
pub struct Conversation {
    pub id: String,
    pub name: String,
    pub last_message: Option<String>,
    pub unread_count: u32,
    pub online: bool,
}

/// Application state.
pub struct App {
    /// Configuration.
    pub config: Config,
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
}

impl App {
    pub fn new(config: Config) -> Self {
        let user_id = config.user_id.clone();
        let status = if config.session_token.is_some() {
            "Ready to connect".into()
        } else {
            "Not logged in".into()
        };

        Self {
            config,
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

    /// Connect to the server.
    pub async fn connect(&mut self) -> Result<()> {
        let token = match &self.config.session_token {
            Some(t) => t.clone(),
            None => {
                self.status = "No session token - please login first".into();
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
                self.status = "Connected".into();
            }
            Err(e) => {
                self.status = format!("Connection failed: {}", e);
            }
        }

        Ok(())
    }

    /// Disconnect from the server.
    pub fn disconnect(&mut self) {
        self.client = None;
        self.connected = false;
        self.status = "Disconnected".into();
    }

    /// Handle a key event.
    pub fn handle_key(&mut self, key: KeyEvent) {
        match self.input_mode {
            InputMode::Normal => self.handle_normal_mode(key),
            InputMode::Editing => self.handle_editing_mode(key),
            InputMode::Command => self.handle_command_mode(key),
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
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if self.selected_conversation > 0 {
                    self.selected_conversation -= 1;
                }
            }
            KeyCode::Char('g') => {
                // Go to top
                self.selected_conversation = 0;
            }
            KeyCode::Char('G') => {
                // Go to bottom
                self.selected_conversation = self.conversations.len().saturating_sub(1);
            }
            _ => {}
        }
    }

    fn handle_editing_mode(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.input_mode = InputMode::Normal;
            }
            KeyCode::Enter => {
                if !self.input.is_empty() {
                    self.send_message();
                }
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

        // Add message to local list
        let messages = self
            .conversation_messages
            .entry(conv.id.clone())
            .or_default();
        messages.push(Message {
            sender: "You".into(),
            content: content.clone(),
            timestamp: chrono_lite_timestamp(),
            is_self: true,
        });

        // Send via WebSocket if connected
        if let Some(client) = &self.client {
            // Parse recipient as UUID (conversation ID is conv_{user_id})
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
                // Connection will be handled in tick()
                self.status = "Use :connect command, then wait...".into();
            }
            "disconnect" | "dc" => {
                self.disconnect();
            }
            _ if cmd.starts_with("chat ") => {
                // Start a new conversation: :chat username
                let username = cmd.strip_prefix("chat ").unwrap().trim();
                if !username.is_empty() {
                    self.start_conversation(username.to_string());
                }
            }
            _ => {
                self.status = format!("Unknown command: {}", cmd);
            }
        }
    }

    /// Start a new conversation with a user.
    fn start_conversation(&mut self, username: String) {
        // Check if conversation already exists
        if let Some(idx) = self.conversations.iter().position(|c| c.name == username) {
            self.selected_conversation = idx;
            return;
        }

        // Create new conversation
        let conv = Conversation {
            id: format!("conv_{}", username),
            name: username.clone(),
            last_message: None,
            unread_count: 0,
            online: false,
        };

        self.conversations.push(conv);
        self.selected_conversation = self.conversations.len() - 1;
        self.status = format!("Started conversation with {}", username);
    }

    /// Process network events.
    pub async fn tick(&mut self) -> Result<()> {
        // Process incoming messages from WebSocket
        // Collect messages first to avoid borrow issues
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

    /// Handle incoming server message.
    fn handle_server_message(&mut self, msg: ServerMessage) {
        match msg {
            ServerMessage::Message {
                sender_id,
                conversation_id,
                ciphertext,
                timestamp,
                ..
            } => {
                // Decode message content (plaintext for now - TODO: decrypt)
                let content = String::from_utf8_lossy(&ciphertext).to_string();
                let conv_id = format!("conv_{}", conversation_id.0);
                let sender_name = sender_id.0.to_string();

                // Find or create conversation
                let conv_exists = self.conversations.iter().any(|c| c.id == conv_id);
                if !conv_exists {
                    self.conversations.push(Conversation {
                        id: conv_id.clone(),
                        name: sender_name.clone(),
                        last_message: Some(content.clone()),
                        unread_count: 1,
                        online: true,
                    });
                } else {
                    // Update existing conversation
                    for conv in &mut self.conversations {
                        if conv.id == conv_id {
                            conv.last_message = Some(content.clone());
                            conv.unread_count += 1;
                        }
                    }
                }

                // Add message
                let messages = self.conversation_messages.entry(conv_id).or_default();
                messages.push(Message {
                    sender: sender_name,
                    content,
                    timestamp: format_timestamp(timestamp),
                    is_self: false,
                });
            }
            ServerMessage::MessageSent { .. } => {
                // Message was delivered to server
            }
            ServerMessage::MessageDelivered { .. } => {
                // Message was delivered to recipient
            }
            ServerMessage::Error { message, .. } => {
                self.status = format!("Error: {}", message);
            }
            ServerMessage::PresenceUpdate { user_id, online } => {
                // Update user presence
                let user_name = user_id.0.to_string();
                for conv in &mut self.conversations {
                    if conv.name == user_name {
                        conv.online = online;
                    }
                }
            }
            _ => {}
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
