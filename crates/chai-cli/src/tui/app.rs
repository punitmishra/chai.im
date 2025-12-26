//! Application state.

use crate::config::Config;
use anyhow::Result;
use crossterm::event::{KeyCode, KeyEvent};

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
    /// Messages in the current conversation.
    pub messages: Vec<Message>,
    /// Scroll offset for messages.
    pub message_scroll: usize,
    /// Status message.
    pub status: String,
    /// Whether connected to server.
    pub connected: bool,
}

impl App {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            input_mode: InputMode::Normal,
            input: String::new(),
            cursor_position: 0,
            conversations: vec![
                Conversation {
                    id: "1".into(),
                    name: "Alice".into(),
                    last_message: Some("Hey, how are you?".into()),
                    unread_count: 2,
                    online: true,
                },
                Conversation {
                    id: "2".into(),
                    name: "Bob".into(),
                    last_message: Some("See you tomorrow!".into()),
                    unread_count: 0,
                    online: false,
                },
                Conversation {
                    id: "3".into(),
                    name: "Team Chat".into(),
                    last_message: Some("Meeting at 3pm".into()),
                    unread_count: 5,
                    online: true,
                },
            ],
            selected_conversation: 0,
            messages: vec![
                Message {
                    sender: "Alice".into(),
                    content: "Hey! How's it going?".into(),
                    timestamp: "10:30".into(),
                    is_self: false,
                },
                Message {
                    sender: "You".into(),
                    content: "Pretty good! Working on the new chat app.".into(),
                    timestamp: "10:31".into(),
                    is_self: true,
                },
                Message {
                    sender: "Alice".into(),
                    content: "Oh nice! The E2E encrypted one?".into(),
                    timestamp: "10:32".into(),
                    is_self: false,
                },
                Message {
                    sender: "You".into(),
                    content: "Yes! Check out this code:\n```rust\nfn encrypt(msg: &str) -> Vec<u8> {\n    // Signal Protocol magic\n}\n```".into(),
                    timestamp: "10:33".into(),
                    is_self: true,
                },
            ],
            message_scroll: 0,
            status: "Disconnected".into(),
            connected: false,
        }
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

        // Add message to list
        self.messages.push(Message {
            sender: "You".into(),
            content,
            timestamp: chrono_lite_timestamp(),
            is_self: true,
        });

        // TODO: Actually send via WebSocket
    }

    fn execute_command(&mut self) {
        let cmd = self.input.trim();
        match cmd {
            "q" | "quit" => {
                // Will be handled by main loop
            }
            "connect" => {
                self.status = "Connecting...".into();
                // TODO: Connect to server
            }
            "disconnect" => {
                self.connected = false;
                self.status = "Disconnected".into();
            }
            _ => {
                self.status = format!("Unknown command: {}", cmd);
            }
        }
    }

    /// Process network events.
    pub async fn tick(&mut self) -> Result<()> {
        // TODO: Process incoming messages from WebSocket
        Ok(())
    }
}

fn chrono_lite_timestamp() -> String {
    // Simple timestamp without chrono dependency
    "now".into()
}
