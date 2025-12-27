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

## Development Session Checkpoint (Dec 27, 2025)

### Latest Session Summary

Group chat frontend integration in progress. Real-time features complete.

### Current PR
- **PR #13**: https://github.com/punitmishra/chai.im/pull/13
- Branch: `feat/group-chat-frontend`

### Merged PRs
- **PR #12**: Real-time typing indicators, message reactions, read receipts ✅
- **PR #11**: UX improvements, security hardening, group chat infrastructure ✅

### What's Working
| Feature | Status |
|---------|--------|
| User Registration (WebAuthn + Password) | ✅ |
| E2E Encryption (Signal Protocol) | ✅ |
| 1:1 Messaging | ✅ |
| Self-Chat (Notes to Self) | ✅ |
| Emoji Picker + Autocomplete | ✅ |
| Keyboard Shortcuts | ✅ |
| Real-time Typing Indicators | ✅ |
| Message Reactions | ✅ |
| Read Receipts | ✅ |
| Group Chat Backend | ✅ |
| Group Chat Frontend (PR #13) | 🔄 In Progress |

### What's Pending
| Feature | Priority |
|---------|----------|
| Group message WebSocket routing | High |
| Message search | Medium |
| File attachments | Low |
| Offline message queue | Low |

### Recent Implementations

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

**1. Password-Based Authentication (Full Stack)**
- Server: `/auth/password/register` and `/auth/password/login` with argon2
- Client: `keyLocker.ts` with PBKDF2 (100k iterations) + AES-256-GCM
- Identity keys encrypted with password, stored in IndexedDB

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
│   └── auth/                   # Login/Register pages
├── components/                 # Shared UI components
│   ├── ErrorBoundary.tsx
│   ├── Loading.tsx
│   └── Toast.tsx
├── lib/
│   ├── api/                    # REST API clients
│   ├── config.ts               # Centralized configuration
│   ├── crypto/                 # WASM crypto + keyLocker
│   ├── logger.ts               # Structured logging
│   └── ws/                     # WebSocket client
├── store/                      # Zustand stores
│   ├── authStore.ts            # Auth state (persisted)
│   ├── chatStore.ts            # Chat state (persisted)
│   ├── connectionStore.ts      # WebSocket connection
│   └── toastStore.ts           # Toast notifications
└── test/                       # Test utilities

crates/chai-server/src/
├── handlers/
│   ├── auth.rs                 # WebAuthn handlers
│   └── password_auth.rs        # Password auth handlers
├── ws/                         # WebSocket server
└── db/                         # PostgreSQL queries
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

## Current Sprint (Dec 26, 2025)

### Parallel Implementation Tracks

| Track | Status | Description |
|-------|--------|-------------|
| CLI-CRYPTO | 🟡 In Progress | E2E encryption integration |
| CLI-AUTH | 🟡 In Progress | Login/register TUI screens |
| WEB-REALTIME | 🟡 In Progress | Typing indicators, read receipts |
| EMOJI | 🟡 In Progress | Emoji picker, custom emojis, reactions |
| GROUP-CHAT | 🟡 In Progress | Group chat with sender keys |
| SHORTCUTS | 🟡 In Progress | Keyboard shortcuts (vim-style) |

### Feature Checklist

**CLI Client**:
- [ ] E2E encryption with chai-crypto
- [ ] Session persistence (encrypted)
- [ ] Login/register TUI screens
- [ ] Vim keybindings (/, ?, 1-9, Ctrl+U/D)
- [ ] Search conversations and messages
- [ ] Reply, edit, delete messages

**Web Client**:
- [ ] Typing indicators
- [ ] Read receipts (double checkmarks)
- [ ] Online/offline status
- [ ] Emoji picker with categories
- [ ] Custom emoji upload
- [ ] Message reactions
- [ ] Keyboard shortcuts (Ctrl+K, Ctrl+/)
- [ ] Command palette

**Shared**:
- [ ] Group chat creation
- [ ] Sender keys protocol
- [ ] Member management
- [ ] Invite links
- [ ] Message editing (5 min window)
- [ ] Message deletion

## Future Roadmap

1. **Phase 1**: Core messaging ✅ Complete
2. **Phase 2**: Real-time features & Groups (current)
3. **Phase 3**: File sharing & media
4. **Phase 4**: Mobile apps (iOS/Android)
5. **Phase 5**: Federation (Matrix-like)

## Database

Using **SQLite** for lightweight embedded storage:
- Custom emojis
- Message reactions
- Group metadata
- Invite links

See `IMPLEMENTATION_PLAN.md` for schema details.
