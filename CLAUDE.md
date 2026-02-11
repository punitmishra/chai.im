# CLAUDE.md

> This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**Chai.im** is a secure, high-throughput end-to-end encrypted chat platform featuring:

- **E2E Encryption**: Signal Protocol (X3DH + Double Ratchet)
- **Authentication**: FIDO2/WebAuthn with hardware tokens
- **Clients**: Next.js PWA (web) + Ratatui TUI (terminal)
- **AI Features**: Local-only AI assistance (privacy-first)
- **Infrastructure**: Rust backend on Fly.io, Next.js on Vercel, PostgreSQL

## Quick Reference

```bash
# Development
pnpm dev              # Web client (localhost:3000)
pnpm server:dev       # Rust server (localhost:8080)
cargo run -p chai-cli # Terminal client

# Build
pnpm build            # Build everything
cargo build --release # Release binaries

# Test
cargo test            # Rust tests
pnpm test             # TypeScript tests

# Lint
cargo clippy          # Rust linter
pnpm lint             # TypeScript linter
```

## Repository Structure

```
chai.im/
├── Cargo.toml                    # Rust workspace root
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml           # Workspace definition
├── turbo.json                    # Build orchestration
├── vercel.json                   # Vercel deployment config
│
├── crates/                       # Rust crates
│   ├── chai-crypto/              # Signal Protocol implementation
│   │   ├── keys.rs               # Identity, prekey, DH keys
│   │   ├── x3dh.rs               # X3DH key agreement
│   │   ├── ratchet.rs            # Double Ratchet state machine
│   │   ├── cipher.rs             # AES-256-GCM encryption
│   │   └── session.rs            # Session management
│   │
│   ├── chai-server/              # Axum WebSocket server
│   │   ├── handlers/auth.rs      # WebAuthn registration/login
│   │   ├── ws/handler.rs         # WebSocket message routing
│   │   ├── ws/connection.rs      # Connection management
│   │   └── db/                   # PostgreSQL queries (SQLx)
│   │
│   ├── chai-protocol/            # Wire protocol (JSON messages)
│   ├── chai-cli/                 # Ratatui terminal client
│   └── chai-common/              # Shared types (UserId, etc.)
│
├── apps/
│   └── web/                      # Next.js 14 PWA
│       ├── src/app/              # App Router pages
│       │   ├── (chat)/           # Chat layout group
│       │   └── auth/             # Auth pages
│       ├── src/components/       # React components
│       ├── src/lib/crypto/       # WASM crypto wrapper
│       ├── src/lib/ws/           # WebSocket client
│       └── src/store/            # Zustand state stores
│
└── packages/
    └── typescript-config/        # Shared TS configs
```

## Key Technical Details

### Cryptography (chai-crypto)

The crypto implementation follows the Signal Protocol specification:

1. **Identity Keys** (Ed25519): Long-term signing keys
2. **Signed Prekeys** (X25519): Medium-term DH keys, signed by identity
3. **One-Time Prekeys** (X25519): Ephemeral keys consumed on first message
4. **X3DH**: Initial key agreement (4 DH operations)
5. **Double Ratchet**: Per-message key derivation with forward secrecy

```rust
// Key flow
IdentityKeyPair::generate()     // Long-term key
SignedPreKey::generate(id, &identity) // Signed with identity
OneTimePreKey::generate(id)     // Ephemeral

// Session establishment
Session::initiate(&identity, peer_id, &bundle)  // Sender
Session::receive(&identity, &spk, &otps, initial_msg) // Receiver

// Message encryption
session.encrypt(plaintext) -> EncryptedMessage
session.decrypt(&encrypted) -> plaintext
```

### Server (chai-server)

Axum-based WebSocket server with:
- Connection management (online users)
- Message routing (store & forward)
- Prekey distribution
- WebAuthn authentication

Key files:
- `ws/handler.rs` — WebSocket upgrade and message dispatch
- `ws/connection.rs` — Track online users by ID
- `handlers/auth.rs` — WebAuthn registration/authentication
- `db/*.rs` — PostgreSQL queries (runtime, no compile-time checks)

### Web Client (apps/web)

Next.js 14 App Router with:
- Zustand for state management
- WASM crypto via wasm-bindgen
- WebSocket with automatic reconnection
- IndexedDB for message persistence (planned)

Key stores:
- `authStore` — User authentication state
- `chatStore` — Conversations and messages
- `connectionStore` — WebSocket connection state

### CLI Client (chai-cli)

Ratatui TUI with vim-like keybindings:
- `j/k` — Navigate conversations
- `i` — Insert mode (type message)
- `:` — Command mode
- `:q` — Quit

## Database Schema

PostgreSQL with SQLx (runtime queries):

```sql
-- Users with identity keys
users (id, username, identity_key, created_at, updated_at)

-- WebAuthn credentials
webauthn_credentials (id, user_id, credential_id, public_key, counter)

-- Prekey bundles for X3DH
prekey_bundles (id, user_id, signed_prekey, signature, prekey_id)

-- One-time prekeys (consumed on use)
one_time_prekeys (id, user_id, prekey, prekey_id, used)

-- Encrypted messages (ciphertext only!)
messages (id, sender_id, recipient_id, ciphertext, message_type, created_at, delivered_at)
```

## Environment Variables

```bash
# Server (required)
DATABASE_URL=postgres://user:pass@localhost/chai
JWT_SECRET=your-secret-key
RP_ID=localhost                   # WebAuthn relying party
RP_ORIGIN=http://localhost:3000   # WebAuthn origin

# Server (optional)
PORT=8080
RUST_LOG=info

# Web client
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

## Common Tasks

### Adding a new message type

1. Add variant to `ClientMessage` or `ServerMessage` in `chai-protocol/src/messages.rs`
2. Add handler in `chai-server/src/ws/handler.rs`
3. Update TypeScript types in `apps/web/src/lib/ws/types.ts`

### Adding a new database table

1. Create migration in `crates/chai-server/migrations/`
2. Add query functions in `crates/chai-server/src/db/`
3. Use runtime queries: `sqlx::query_as::<_, Type>(...)`

### Updating crypto primitives

1. Modify implementation in `crates/chai-crypto/src/`
2. Rebuild WASM: `pnpm build:wasm`
3. Update TypeScript wrapper in `apps/web/src/lib/crypto/`

## Security Considerations

- **Never log plaintext messages or keys**
- **Use constant-time comparison for secrets**
- **Validate all input from clients**
- **Use parameterized queries (SQLx handles this)**
- **Rotate signing keys periodically**

## Deployment

### Fly.io (Backend)

The Rust backend is deployed to Fly.io with a managed PostgreSQL database.

**Live URL:** https://chai-server.fly.dev

```bash
# Install Fly CLI (if not installed)
curl -L https://fly.io/install.sh | sh

# Login to Fly
fly auth login

# Deploy (from repo root)
fly deploy

# View logs
fly logs -a chai-server
```

Secrets are configured via:
```bash
fly secrets set JWT_SECRET=... RP_ID=... RP_ORIGIN=... -a chai-server
```

### Vercel (Frontend)

The Next.js frontend is auto-deployed to Vercel on push to master.

Environment variables to set in Vercel:
- `NEXT_PUBLIC_API_URL=https://chai-server.fly.dev`
- `NEXT_PUBLIC_WS_URL=wss://chai-server.fly.dev/ws`

### Local Development

```bash
# Start PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:15

# Set environment
export DATABASE_URL=postgres://postgres:dev@localhost/chai

# Run migrations
cd crates/chai-server && sqlx migrate run

# Start servers
pnpm dev          # Terminal 1: Web client
pnpm server:dev   # Terminal 2: Backend
```

## Troubleshooting

### SQLx compile errors

The project uses runtime queries (`query_as::<_, Type>`) to avoid needing `DATABASE_URL` at compile time. If you see sqlx errors, ensure you're not using `query_as!` macros.

### WASM build fails

```bash
# Install wasm-pack
cargo install wasm-pack

# Rebuild
cd crates/chai-crypto && wasm-pack build --target web
```

### OpenSSL errors

```bash
# macOS
brew install openssl pkg-config
export PKG_CONFIG_PATH="/opt/homebrew/opt/openssl/lib/pkgconfig"
```

### Port already in use

Web client automatically tries port 3001 if 3000 is busy. Backend uses 8080.

## Development Session Checkpoint (Feb 8, 2026)

### Latest Session Summary

Group chat frontend UI complete: GroupInfoPanel, MemberList, AddMemberDialog, InviteLinkDialog, sender name labels, group store. Also includes group WS protocol, message search, file attachments, and CLI fixes from earlier in the session. PR #31 merged.

### Screenshots

Feature screenshots captured in `docs/screenshots/`:

| Screenshot | Description |
|-----------|-------------|
| `01-landing-page.png` | Landing page with countdown, encryption demo, waitlist signup |
| `02-register.png` | Account registration with username + security key steps |
| `03-login.png` | Login with Security Key or Recovery Phrase options |
| `04-chat-layout.png` | Chat interface layout (requires auth) |
| `05-new-chat.png` | New conversation view (requires auth) |
| `06-mobile-landing.png` | Mobile-responsive landing page (390x844) |

### Merged PRs (This Session)
- **PR #31**: Group chat WS handlers, message search improvements, file attachments ✅
- **Commit a159df1**: Group chat frontend UI (GroupInfoPanel, member management, invite links) ✅
- **PR #26**: CLI identity key authentication with TUI screens ✅
- **PR #24**: Passwordless authentication feature ✅
- **PR #23**: Chai.im feature development ✅

### Merged PRs (Previous Sessions)
- **PR #20**: Fix Vercel build - exclude @xenova/transformers from server bundle ✅
- **PR #19**: Docs update checkpoint for Dec 28 with launch page features ✅
- **Commit 38b8617**: Slack-like features and waitlist signup ✅
- **PR #18**: Launch date update (February 1, 2026) ✅
- **PR #12**: Real-time typing indicators, message reactions, read receipts ✅
- **PR #11**: UX improvements, security hardening, group chat infrastructure ✅

### Production Status
| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://chai.im | ✅ Live |
| Backend | https://chai-server.fly.dev | ✅ Live |
| Waitlist API | https://chai-server.fly.dev/waitlist | ✅ Working |

### What's Working
| Feature | Status |
|---------|--------|
| User Registration (WebAuthn + Identity Key) | ✅ |
| E2E Encryption (Signal Protocol) | ✅ |
| 1:1 Messaging | ✅ |
| Self-Chat (Notes to Self) | ✅ |
| Emoji Picker + Autocomplete | ✅ |
| Keyboard Shortcuts | ✅ |
| Real-time Typing Indicators | ✅ |
| Message Reactions | ✅ |
| Read Receipts | ✅ |
| Group Chat Backend (REST) | ✅ |
| **Group Chat WebSocket Protocol** | ✅ New |
| **Message Search (Client-side)** | ✅ New |
| **File Attachments (Upload/Download)** | ✅ New |
| **CLI Identity Key Auth** | ✅ New |
| **Group Chat Frontend UI** | ✅ New |
| **Launch Page** | ✅ Deployed |
| **Countdown Timer** | ✅ Deployed |
| **Encryption Demo** | ✅ Deployed |
| **Waitlist Signup** | ✅ Deployed |
| **Security Badges** | ✅ Deployed |
| **Local AI Features** | ⚠️ Disabled (see Known Issues) |

### What's Pending
| Feature | Priority |
|---------|----------|
| Re-enable @xenova/transformers AI features | High |
| Sender Keys protocol for group E2E encryption | Medium |
| File attachment E2E encryption (per-file keys) | Medium |
| Offline message queue | Low |

### Known Issues

**Vercel GitHub Integration**
- GitHub status checks show "Deployment failed" even when site is live
- This appears to be a stale integration issue after project move to greplabs team
- **Workaround**: Check Vercel dashboard directly at https://vercel.com/greplabs/chai.im
- Site is actually deployed and working despite the status

**@xenova/transformers Disabled**
- The ML package was temporarily removed due to native dependency issues (sharp, onnxruntime-node)
- AI features (summarization, smart replies, semantic search) are disabled
- Code gracefully handles missing package
- **To re-enable**: Add back to package.json with proper serverExternalPackages config

### Recent Implementations

**Group Chat Frontend UI (Feb 8, 2026)**
- GroupInfoPanel: slide-out right sidebar with group details, inline editing, admin actions
- MemberList: sorted by role (owner/admin/member), role badges, online status, remove button
- AddMemberDialog: user search with debounce, filters existing members
- InviteLinkDialog: configurable max uses and expiry, copyable invite codes
- Zustand `groupStore` with persist middleware for group state and members
- REST API client (`lib/api/groups.ts`) wrapping all 11 server endpoints
- Sender name labels (purple) above group messages, grouped by sender
- Clickable group header showing member count, opens info panel
- Fixed layout.tsx `/groups/me` bug (server only has `GET /groups`)
- Refactored CreateGroupModal to use centralized API client

**Group Chat WebSocket Protocol (Feb 8, 2026)**
- Added `SendGroupMessage`, `GroupMessage`, `CreateGroup`, `GroupCreated` WS message types
- Server-side fan-out: messages delivered to all online group members
- Group creation via WebSocket with automatic membership
- Protocol types in `chai-protocol/src/messages.rs`
- Server handlers in `chai-server/src/ws/message.rs`
- Web client types in `apps/web/src/lib/ws/types.ts`

**Message Search Improvements (Feb 8, 2026)**
- Cleaned up SearchModal: removed dead @xenova/transformers imports
- Client-side full-text search across all decrypted messages
- Filter by conversation and date range
- Keyboard shortcut Ctrl+K to open search
- Search result highlighting with click-to-navigate

**File Attachments (Feb 8, 2026)**
- Server: `POST /files/upload` (multipart, 25MB limit), `GET /files/:file_id`
- Database migration: `006_attachments.sql` (attachments table)
- Server handlers: `handlers/files.rs`, DB layer: `db/files.rs`
- Web client: `lib/api/attachments.ts` (upload, download, URL helpers)
- `AttachmentDisplay` component: inline image previews, file cards with download
- File upload button in conversation input (paperclip icon)
- Supported types: images, PDFs, video, audio, documents, archives

**CLI Improvements (Feb 8, 2026)**
- Identity key authentication with TUI screens (PR #26)
- E2E chat bot example (`crates/chai-cli/examples/chat_bot.rs`)
- E2E test example (`crates/chai-cli/examples/test_e2e_chat.rs`)
- Fixed clippy warnings across CLI crate for Rust 1.93.0

**Deployment & Infrastructure (Dec 28, 2025)**
- Deployed backend to Fly.io with waitlist migration
- Fixed Vercel build issues with server-side ML package exclusion
- Added `serverExternalPackages` config for Next.js
- Added webpack externals for @xenova/transformers

**Launch Page & Waitlist (Dec 28, 2025)**
- Interactive countdown timer to Feb 1, 2026 launch
- Real-time encryption demo (AES-256-GCM visualization)
- Email waitlist signup with position tracking
- Security badges with hover tooltips
- Waitlist API: POST `/waitlist`, GET `/waitlist/count`
- Database migration: `004_waitlist.sql`

**Real-time WebSocket Features (PR #12)**
- Typing indicators with debouncing (5s auto-stop)
- Message reactions (add/remove/toggle)
- Read receipts with status updates
- Presence updates

**UX & Infrastructure (PR #11)**
- Emoji picker + autocomplete
- Keyboard shortcuts system
- Group chat API endpoints
- CORS security hardening
- Performance: 16,823 req/sec at 100 concurrent

### Previous Session Completed Features

**1. Identity Key Authentication (Passwordless)**
- Server: `/auth/identity/register`, `/auth/identity/challenge`, `/auth/identity/verify`
- Client: Ed25519 identity keys derived from BIP39 mnemonic
- Challenge-response authentication with cryptographic signatures
- Identity keys stored in IndexedDB (device trust model)

**2. Centralized Configuration & Logging**
- `lib/config.ts`: API_URL, WS_URL, app constants
- `lib/logger.ts`: Environment-aware structured logging

**3. WebSocket Improvements**
- Type-safe message handling
- Automatic one-time prekey replenishment
- Configurable reconnection

**4. UI Components & Theme**
- `ErrorBoundary`, `ToastContainer`, `Loading` components
- Zinc/Amber color scheme throughout

**5. Testing Infrastructure**
- Vitest with 25 tests (all passing)
- Crypto polyfills for Node.js

### Architecture Overview
```
apps/web/src/
├── app/                        # Next.js App Router
│   ├── (chat)/                 # Chat layout group
│   │   └── [conversationId]/   # Chat view with file upload
│   ├── auth/                   # Login/Register pages
│   └── page.tsx                # Launch page
├── components/                 # Shared UI components
│   ├── ErrorBoundary.tsx
│   ├── Loading.tsx
│   ├── Toast.tsx
│   ├── SearchModal.tsx         # Message search (Ctrl+K)
│   ├── chat/
│   │   ├── MessageBubble.tsx   # Message display with attachments + sender labels
│   │   └── AttachmentDisplay.tsx # File/image attachment renderer
│   ├── group/
│   │   ├── GroupInfoPanel.tsx  # Group details slide-out panel
│   │   ├── MemberList.tsx      # Member list with roles + remove
│   │   ├── AddMemberDialog.tsx # User search + add member modal
│   │   └── InviteLinkDialog.tsx # Invite code generation modal
│   └── launch/                 # Launch page components
│       ├── CountdownTimer.tsx
│       ├── EncryptionDemo.tsx
│       ├── EmailSignup.tsx
│       └── SecurityBadges.tsx
├── lib/
│   ├── api/
│   │   ├── attachments.ts      # File upload/download API
│   │   └── groups.ts           # Groups REST API client (11 endpoints)
│   ├── config.ts               # Centralized configuration
│   ├── crypto/                 # WASM crypto + keyLocker
│   ├── logger.ts               # Structured logging
│   └── ws/
│       ├── client.ts           # WebSocket client + group message handling
│       └── types.ts            # WS message types (incl. group)
├── store/                      # Zustand stores
│   ├── authStore.ts            # Auth state (persisted)
│   ├── chatStore.ts            # Chat state + Attachment type (persisted)
│   ├── groupStore.ts           # Group state + members (persisted)
│   ├── connectionStore.ts      # WebSocket connection
│   └── toastStore.ts           # Toast notifications
└── test/                       # Test utilities

crates/chai-server/src/
├── handlers/
│   ├── auth.rs                 # WebAuthn handlers
│   ├── identity_auth.rs        # Mnemonic/signature auth handlers
│   ├── contacts.rs             # Peer identity exchange handlers
│   ├── files.rs                # File upload/download handlers
│   └── waitlist.rs             # Waitlist signup handlers
├── ws/
│   ├── handler.rs              # WebSocket upgrade + dispatch
│   └── message.rs              # Message handling (incl. group messages)
├── db/
│   └── files.rs                # Attachment DB operations
└── migrations/
    └── 006_attachments.sql     # Attachments table

crates/chai-cli/
├── src/tui/app.rs              # TUI app with identity key auth
├── src/network/client.rs       # WebSocket client
└── examples/
    ├── chat_bot.rs             # E2E encrypted echo bot
    └── test_e2e_chat.rs        # E2E chat integration test

docs/screenshots/               # Feature screenshots
```

### Local Development
```bash
# PostgreSQL via Docker
docker start chai-postgres

# Backend (port 5000)
PORT=5000 DATABASE_URL="postgres://postgres:postgres@localhost:5433/chai" \
JWT_SECRET="dev-secret-key" RP_ID="localhost" RP_ORIGIN="http://localhost:5001" \
cargo run -p chai-server

# Frontend (port 5001)
cd apps/web && pnpm dev

# Run tests
pnpm test:run
```

### Next Steps
See `IMPLEMENTATION_PLAN.md` for detailed task breakdown.

## Current Sprint (Feb 8, 2026)

### Parallel Implementation Tracks

| Track | Status | Description |
|-------|--------|-------------|
| LAUNCH-PAGE | ✅ Deployed | Launch page, countdown, waitlist |
| DEPLOYMENT | ✅ Complete | Fly.io backend, Vercel frontend |
| WEB-REALTIME | ✅ Complete | Typing indicators, read receipts |
| EMOJI | ✅ Complete | Emoji picker, reactions |
| LOCAL-AI | ⚠️ Disabled | @xenova/transformers needs fix |
| CLI-CRYPTO | ✅ Complete | E2E encryption integration |
| CLI-AUTH | ✅ Complete | Login/register TUI screens |
| GROUP-CHAT-WS | ✅ Complete | Group chat WebSocket protocol |
| GROUP-CHAT-UI | ✅ Complete | Group chat frontend components |
| MESSAGE-SEARCH | ✅ Complete | Client-side message search |
| FILE-ATTACHMENTS | ✅ Complete | Upload/download with previews |

### Feature Checklist

**Launch Page** (✅ Deployed to Production):
- [x] Countdown timer to launch
- [x] Real-time encryption demo
- [x] Email waitlist signup
- [x] Security badges
- [x] Waitlist API endpoints
- [x] Database migration applied

**Group Chat**:
- [x] Group chat backend (REST API - 14 endpoints)
- [x] Group chat WebSocket protocol (SendGroupMessage, GroupMessage, CreateGroup)
- [x] Server-side message fan-out to group members
- [x] Group chat frontend UI (GroupInfoPanel, MemberList, sender labels)
- [x] Member management UI (AddMemberDialog, remove, role badges)
- [x] Invite links (InviteLinkDialog with max uses/expiry)
- [x] Zustand group store with REST API client
- [ ] Sender keys protocol (E2E group encryption)

**Message Search** (✅ Complete):
- [x] Client-side full-text search across messages
- [x] Filter by conversation and date range
- [x] Search result highlighting
- [x] Ctrl+K keyboard shortcut

**File Attachments** (✅ Complete):
- [x] Server upload endpoint (POST /files/upload, 25MB limit)
- [x] Server download endpoint (GET /files/:file_id)
- [x] Database migration (006_attachments.sql)
- [x] Web client upload API
- [x] AttachmentDisplay component (image previews, file cards)
- [x] File upload button in chat input
- [ ] E2E encryption for file content (per-file AES keys)

**Local AI Features** (⚠️ Temporarily Disabled):
- [ ] Re-add @xenova/transformers with proper config
- [ ] Message summarization
- [ ] Smart replies
- [ ] Semantic search
- [ ] Translation

**CLI Client**:
- [x] E2E encryption with chai-crypto
- [x] Login/register TUI screens
- [x] Identity key authentication
- [ ] Session persistence (encrypted)
- [ ] Vim keybindings (/, ?, 1-9, Ctrl+U/D)
- [ ] Search conversations and messages
- [ ] Reply, edit, delete messages

**Web Client** (Mostly Complete):
- [x] Typing indicators
- [x] Read receipts (double checkmarks)
- [x] Online/offline status
- [x] Emoji picker with categories
- [x] Message reactions
- [x] Keyboard shortcuts (Ctrl+K, Ctrl+/)
- [x] File attachments in messages
- [x] Message search
- [ ] Custom emoji upload
- [ ] Command palette

**Shared**:
- [x] Group chat backend (REST + WS)
- [x] Group chat frontend (info panel, members, invites, sender labels)
- [ ] Message editing (5 min window)
- [ ] Message deletion

## Authentication Strategy

Chai.im uses a **passwordless, identity-key based authentication** model:

### Supported Auth Methods
| Method | Description | Status |
|--------|-------------|--------|
| **WebAuthn/Passkeys** | FIDO2 hardware tokens, biometrics | ✅ Primary |
| **Identity Key** | Ed25519 keys from BIP39 mnemonic | ✅ Primary |
| **Password** | ~~Argon2 password hashing~~ | ❌ Removed |

### Why No Passwords?
1. **Security**: Passwords are the weakest link in most systems
2. **Phishing-proof**: Passkeys and identity keys can't be phished
3. **Privacy**: No password = no password to leak in a breach
4. **User experience**: No forgotten passwords, no password managers needed

### Identity Key Authentication Flow
```
1. Generate 24-word BIP39 mnemonic (client-side)
2. Derive Ed25519 identity keypair from mnemonic
3. Register: Submit public key to server
4. Login: Sign server-provided challenge with private key
5. Server verifies signature → issues session token
```

## Peer Identity Exchange

For adding contacts without centralized lookup:

### Exchange Methods
| Method | Use Case |
|--------|----------|
| **Identity Link** | Share via secure channel (Signal, email) |
| **QR Code** | In-person scanning (coming soon) |
| **Safety Numbers** | Verify peer identity out-of-band |

### API Endpoints
```
POST /contacts                 # Add by user ID
POST /contacts/by-key          # Add by identity key
GET  /contacts                 # List all contacts
POST /contacts/:id/verify      # Mark as verified
DELETE /contacts/:id           # Remove contact
```

### Identity Card Format
```typescript
interface IdentityCard {
  version: 1;
  username: string;
  userId: string;
  identityKey: string;  // Base64 Ed25519 public key
  timestamp: number;
}
```

### Safety Numbers
Computed from both identity keys using SHA-256:
- 60-digit numeric code (12 groups of 5)
- Short 8-character fingerprint
- Same on both devices if keys match

## Future Roadmap

1. **Phase 1**: Core messaging ✅ Complete
2. **Phase 2**: Real-time features & Groups ✅ Complete (backend + frontend)
3. **Phase 3**: File sharing & media ✅ Infrastructure complete, E2E file encryption pending
4. **Phase 4**: Mobile apps (iOS/Android)
5. **Phase 5**: Federation (Matrix-like)

## Database

Using **SQLite** for lightweight embedded storage:
- Custom emojis
- Message reactions
- Group metadata
- Invite links

See `IMPLEMENTATION_PLAN.md` for schema details.
