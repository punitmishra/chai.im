//! WebSocket client.

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use chai_protocol::{ClientMessage, ServerMessage};

/// WebSocket client for server communication.
pub struct Client {
    /// Channel to send messages to the server.
    tx: mpsc::Sender<ClientMessage>,
    /// Channel to receive messages from the server.
    rx: mpsc::Receiver<ServerMessage>,
}

impl Client {
    /// Connect to the server.
    pub async fn connect(url: &str) -> Result<Self> {
        let (ws_stream, _) = connect_async(url).await?;
        let (mut write, mut read) = ws_stream.split();

        // Create channels
        let (outgoing_tx, mut outgoing_rx) = mpsc::channel::<ClientMessage>(100);
        let (incoming_tx, incoming_rx) = mpsc::channel::<ServerMessage>(100);

        // Spawn task to send messages
        tokio::spawn(async move {
            while let Some(msg) = outgoing_rx.recv().await {
                let data = chai_protocol::json::encode_client_message(&msg).unwrap();
                if write.send(Message::Text(data)).await.is_err() {
                    break;
                }
            }
        });

        // Spawn task to receive messages
        tokio::spawn(async move {
            while let Some(Ok(msg)) = read.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(server_msg) = chai_protocol::json::decode_server_message(&text) {
                        if incoming_tx.send(server_msg).await.is_err() {
                            break;
                        }
                    }
                }
            }
        });

        Ok(Self {
            tx: outgoing_tx,
            rx: incoming_rx,
        })
    }

    /// Send a message to the server.
    pub async fn send(&self, msg: ClientMessage) -> Result<()> {
        self.tx.send(msg).await?;
        Ok(())
    }

    /// Try to receive a message from the server (non-blocking).
    pub fn try_recv(&mut self) -> Option<ServerMessage> {
        self.rx.try_recv().ok()
    }

    /// Receive a message from the server (blocking).
    pub async fn recv(&mut self) -> Option<ServerMessage> {
        self.rx.recv().await
    }
}
