# CLAUDE.md

> This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**Chai.im** is a secure, high-throughput end-to-end encrypted chat platform featuring:

- **E2E Encryption**: Signal Protocol (X3DH + Double Ratchet)
- **Authentication**: FIDO2/WebAuthn with hardware tokens
- **Clients**: Next.js PWA (web) + Ratatui TUI (terminal)
- **AI Features**: Local-only AI assistance (privacy-first)
- **Infrastructure**: Rust backend on Fly.io, PostgreSQL

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
├── fly.toml                      # Fly.io deployment
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

### Fly.io

```bash
fly launch --name chai-server
fly postgres create --name chai-db
fly secrets set DATABASE_URL=... JWT_SECRET=... RP_ID=... RP_ORIGIN=...
fly deploy
```

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

## Development Session Checkpoint (Dec 26, 2025 - Evening)

### Session Summary

This session focused on code cleanup, optimization, and establishing production-ready patterns.

### Completed Features

**1. Password-Based Authentication (Full Stack)**
- Server: Added `/auth/password/register` and `/auth/password/login` with argon2 hashing
- Client: `keyLocker.ts` with PBKDF2 (100k iterations) + AES-256-GCM
- Identity keys encrypted with user password, stored in IndexedDB

**2. Centralized Configuration & Logging**
- `lib/config.ts`: API_URL, WS_URL, and app constants in one place
- `lib/logger.ts`: Environment-aware logging (debug only in dev)
- Replaced 30+ console statements with structured logger calls

**3. WebSocket Improvements**
- Type-safe message handling with discriminated unions
- Automatic one-time prekey replenishment when running low
- Toast notifications for session restoration failures
- Configurable ping interval and reconnection delays

**4. UI Components & Theme**
- `ErrorBoundary`: Crash handling with recovery UI
- `ToastContainer`: Animated notifications (success/error/warning/info)
- `Loading`: Consistent spinner component
- Zinc/Amber color scheme throughout

**5. Testing Infrastructure**
- Vitest with jsdom environment
- 25 tests across 4 files (all passing)
- Crypto polyfills for Node.js environment

**6. Production Hardening**
- Security headers in next.config.js
- OpenGraph metadata for social sharing
- Store exports properly organized

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
1. End-to-end testing of registration/login flow
2. Test encrypted messaging between two users
3. CLI client polish (vim keybindings, better UI)
4. Deploy to Fly.io for production

## Future Roadmap

1. **Phase 1**: Core messaging (current)
2. **Phase 2**: Group chats with sender keys
3. **Phase 3**: Voice/video calls (WebRTC)
4. **Phase 4**: Mobile apps (iOS/Android)
5. **Phase 5**: Federation (Matrix-like)
