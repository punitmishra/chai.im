# Chai.im Engineering Roadmap

## Vision: A Lightweight, High-Throughput Slack Alternative

Build the fastest, most secure team messaging platform with unique AI-native capabilities that Slack doesn't have.

---

## Architecture Principles

### 1. Lightweight Rust Core
- **Zero-copy message routing** - Use `bytes::Bytes` for WebSocket frames
- **Lock-free data structures** - `dashmap` for connection registry
- **Async-first** - Tokio with `io_uring` on Linux
- **Memory pooling** - Pre-allocated buffers for message serialization

### 2. High-Throughput Design
- **Target**: 100K concurrent connections, 1M messages/sec
- **Connection sharding** - Consistent hashing across worker threads
- **Batch database writes** - Aggregate messages before INSERT
- **Redis pub/sub** - Horizontal scaling across nodes

### 3. Elegant Simplicity
- **Single binary deployment** - No microservices complexity
- **Embedded migrations** - Schema versioning in binary
- **Config-free defaults** - Sensible production defaults out of box

---

## Phase 1: Performance Foundation (Week 1)

### 1.1 Connection Manager Rewrite
**File**: `crates/chai-server/src/ws/connection.rs`

Replace `HashMap<UserId, Vec<Sender>>` with:
```rust
use dashmap::DashMap;
use tokio::sync::broadcast;

pub struct ConnectionManager {
    // Sharded by user_id for lock-free access
    connections: DashMap<UserId, UserConnections>,
    // Global broadcast for presence updates
    presence_tx: broadcast::Sender<PresenceEvent>,
}

pub struct UserConnections {
    devices: SmallVec<[DeviceConnection; 4]>,  // Most users have <4 devices
    last_seen: Instant,
}
```

**Benefits**:
- Lock-free concurrent access
- SmallVec avoids heap allocation for typical case
- Broadcast channel for efficient presence fanout

### 1.2 Message Batching
**File**: `crates/chai-server/src/db/messages.rs`

```rust
pub struct MessageBatcher {
    buffer: Vec<PendingMessage>,
    flush_interval: Duration,
    max_batch_size: usize,
}

impl MessageBatcher {
    // Batch INSERT with COPY protocol for 10x throughput
    async fn flush(&mut self, pool: &PgPool) -> Result<()> {
        let mut copy = pool.copy_in_raw("COPY messages FROM STDIN").await?;
        for msg in self.buffer.drain(..) {
            copy.send(msg.to_copy_row()).await?;
        }
        copy.finish().await
    }
}
```

### 1.3 Zero-Copy WebSocket Frames
**File**: `crates/chai-server/src/ws/codec.rs`

```rust
use bytes::{Bytes, BytesMut};
use tokio_util::codec::{Decoder, Encoder};

pub struct MessageCodec {
    // Pre-allocated buffer pool
    buffer_pool: BufferPool,
}

impl Decoder for MessageCodec {
    type Item = ClientMessage;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>> {
        // Zero-copy JSON parsing with simd-json
        simd_json::from_slice(src.split().freeze().as_ref())
    }
}
```

---

## Phase 2: Slack-Like Features (Week 2)

### 2.1 Channels & Threads

**Database Migration**: `004_channels_threads.sql`
```sql
-- Channels (public/private groups)
ALTER TABLE groups ADD COLUMN channel_type VARCHAR(20) DEFAULT 'channel';
ALTER TABLE groups ADD COLUMN topic TEXT;
ALTER TABLE groups ADD COLUMN pinned_message_ids UUID[];

-- Message threading
ALTER TABLE messages ADD COLUMN thread_id UUID REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN reply_count INT DEFAULT 0;
ALTER TABLE messages ADD COLUMN latest_reply_at TIMESTAMPTZ;

-- Thread participants (for notification targeting)
CREATE TABLE thread_participants (
    thread_id UUID REFERENCES messages(id),
    user_id UUID REFERENCES users(id),
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX idx_messages_thread ON messages(thread_id) WHERE thread_id IS NOT NULL;
```

**New Message Types**:
```rust
// Client -> Server
ThreadReply { thread_id: MessageId, ciphertext: Vec<u8> }
SubscribeThread { thread_id: MessageId }
UnsubscribeThread { thread_id: MessageId }

// Server -> Client
ThreadUpdate { thread_id: MessageId, reply_count: u32, latest_reply: Message }
```

### 2.2 Rich Message Features

**Message Formatting**:
- Markdown rendering (bold, italic, code, links)
- Code blocks with syntax highlighting (highlight.js)
- Emoji shortcodes (`:smile:` -> emoji)
- @mentions with user linking
- Channel linking (`#channel-name`)

**Message Actions**:
- Pin/unpin messages
- Bookmark messages
- Forward to another channel
- Share message link

**File Attachments** (encrypted):
```rust
pub struct Attachment {
    id: AttachmentId,
    filename: String,
    content_type: String,
    size: u64,
    // Encrypted with message-specific key
    encrypted_url: String,
    thumbnail_url: Option<String>,
}
```

### 2.3 Advanced Presence

```rust
pub enum UserStatus {
    Active,
    Away,
    DoNotDisturb { until: Option<DateTime<Utc>> },
    InCall { channel_id: ChannelId },
    Custom { emoji: String, text: String, until: Option<DateTime<Utc>> },
}

pub struct PresenceUpdate {
    user_id: UserId,
    status: UserStatus,
    typing_in: Option<ConversationId>,
    last_active: DateTime<Utc>,
}
```

---

## Phase 3: Unique Capabilities (Week 3)

### 3.1 AI-Native Features (Privacy-First)

**Local AI Processing** - All AI runs client-side in WASM:

1. **Smart Reply Suggestions**
   - TinyLlama quantized to WASM
   - Suggests 3 contextual replies
   - Never sends content to server

2. **Message Summarization**
   - Catch up on long threads
   - "Summarize last 50 messages"
   - Runs entirely in browser

3. **Semantic Search**
   - Vector embeddings computed client-side
   - Search by meaning, not just keywords
   - IndexedDB vector store

4. **Auto-Translation**
   - Detect language, offer translation
   - OPUS-MT models in WASM
   - Keep original + translation

**Implementation**:
```typescript
// apps/web/src/lib/ai/local-llm.ts
import { Pipeline, pipeline } from '@xenova/transformers';

class LocalAI {
    private summarizer: Pipeline | null = null;

    async summarize(messages: Message[]): Promise<string> {
        if (!this.summarizer) {
            this.summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
        }
        const text = messages.map(m => m.content).join('\n');
        const result = await this.summarizer(text, { max_length: 100 });
        return result[0].summary_text;
    }
}
```

### 3.2 Collaborative Features

1. **Live Cursors in Long Messages**
   - See where others are reading
   - Collaborative editing for drafts

2. **Huddles** (Instant Voice)
   - Click to start impromptu voice chat
   - WebRTC with E2E encryption
   - Auto-transcription (local Whisper)

3. **Canvas** (Shared Whiteboard)
   - Excalidraw-style collaborative drawing
   - Embedded in any message thread
   - CRDT-based sync

### 3.3 Developer Experience

1. **Slash Commands**
   - `/remind @user in 2h to review PR`
   - `/poll "Lunch spot?" Pizza, Sushi, Tacos`
   - `/code rust fn main() { ... }`

2. **Webhooks & Bots**
   - Incoming webhooks for CI/CD
   - Bot user framework
   - Custom integrations API

3. **Message Actions API**
   - Add custom actions to message menu
   - Trigger workflows from messages

---

## Phase 4: Horizontal Scaling (Week 4)

### 4.1 Redis Integration

**Connection State Distribution**:
```rust
// crates/chai-server/src/cluster/redis.rs
pub struct ClusterConnectionManager {
    local: ConnectionManager,
    redis: redis::Client,
    node_id: NodeId,
}

impl ClusterConnectionManager {
    async fn route_message(&self, user_id: UserId, msg: ServerMessage) {
        // Check local first
        if self.local.send_to(user_id, &msg).await {
            return;
        }

        // Find which node has the user
        let node: Option<NodeId> = self.redis
            .get(format!("user:{}:node", user_id))
            .await?;

        if let Some(target_node) = node {
            // Publish to that node's channel
            self.redis.publish(
                format!("node:{}", target_node),
                serde_json::to_string(&RouteRequest { user_id, msg })?
            ).await?;
        }
    }
}
```

### 4.2 Database Read Replicas

```rust
pub struct DatabasePool {
    writer: PgPool,  // Primary for writes
    readers: Vec<PgPool>,  // Read replicas
    round_robin: AtomicUsize,
}

impl DatabasePool {
    fn reader(&self) -> &PgPool {
        let idx = self.round_robin.fetch_add(1, Ordering::Relaxed);
        &self.readers[idx % self.readers.len()]
    }
}
```

### 4.3 Message Queue for Reliability

```rust
// Guaranteed delivery with at-least-once semantics
pub struct MessageQueue {
    redis: redis::Client,
}

impl MessageQueue {
    async fn enqueue(&self, msg: OutboundMessage) {
        self.redis.xadd(
            "messages:outbound",
            "*",
            &[("payload", serde_json::to_string(&msg)?)],
        ).await?;
    }

    async fn process_loop(&self) {
        loop {
            let entries = self.redis.xread_group(
                "messages:outbound",
                "workers",
                &self.worker_id,
            ).await?;

            for entry in entries {
                if self.deliver(entry.payload).await.is_ok() {
                    self.redis.xack("messages:outbound", "workers", entry.id).await?;
                }
            }
        }
    }
}
```

---

## Phase 5: Polish & Launch (Week 5)

### 5.1 UI/UX Refinements

- **Keyboard Navigation**: Full Slack-like shortcuts
  - `Cmd+K`: Quick switcher
  - `Cmd+/`: Show all shortcuts
  - `Up`: Edit last message
  - `Esc`: Close modals, cancel edits

- **Themes**: Dark (default), Light, High Contrast
- **Compact Mode**: Dense message layout option
- **Custom Emoji**: Upload team emoji

### 5.2 Mobile PWA

- Service Worker for offline support
- Push notifications via Web Push API
- Responsive layout (already using Tailwind)
- Touch gestures (swipe to archive)

### 5.3 Admin Dashboard

- User management (invite, deactivate)
- Channel management (archive, permissions)
- Usage analytics (message volume, active users)
- Compliance exports (for enterprise)

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Connection Manager Rewrite | High | Medium | P0 |
| Message Threading | High | Medium | P0 |
| Redis Pub/Sub | High | Medium | P0 |
| Rich Text/Markdown | Medium | Low | P1 |
| Local AI (Summarize) | High | High | P1 |
| File Attachments | Medium | Medium | P1 |
| Huddles (Voice) | High | High | P2 |
| Slash Commands | Medium | Low | P2 |
| Admin Dashboard | Medium | Medium | P2 |
| Canvas (Whiteboard) | Low | High | P3 |

---

## Parallel Agent Assignments

### Agent 1: Performance Core
- Connection manager with DashMap
- Message batching with COPY protocol
- Zero-copy WebSocket codec
- Benchmark suite

### Agent 2: Channels & Threading
- Database migrations
- Server message handlers
- Frontend thread UI
- Thread notification logic

### Agent 3: Rich Messages & UI
- Markdown rendering
- Emoji picker enhancement
- File upload component
- Message actions menu

### Agent 4: AI Features
- Xenova/transformers integration
- Summarization pipeline
- Smart reply component
- Local vector search

### Agent 5: Real-time Features
- Typing indicators enhancement
- Presence system upgrade
- Read receipts polish
- Online status improvements

---

## Success Metrics

- **Performance**: <50ms p99 message latency
- **Reliability**: 99.9% uptime
- **Scale**: 100K concurrent users per node
- **Adoption**: 1000 daily active users in first month
- **Security**: Zero plaintext message exposure

---

## Getting Started

```bash
# Run all tests
cargo test --workspace
pnpm test:run

# Start development
pnpm dev              # Frontend
cargo run -p chai-server  # Backend

# Benchmark
cargo bench -p chai-server

# Deploy
fly deploy            # Backend
vercel --prod         # Frontend
```
