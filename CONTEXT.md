# Chai.im Development Context

> Last updated: 2025-12-25
> This file tracks ongoing work and development context for Claude Code sessions.

## Current State Summary

The project underwent a **major architectural rewrite** (commit `aaf67a9`) replacing the original stack with:
- **Backend**: Rust/Axum WebSocket server
- **Frontend**: Next.js 14 PWA
- **CLI**: Ratatui TUI client
- **Crypto**: Signal Protocol (X3DH + Double Ratchet)

## Recent Work Completed (2025-12-25)

### Session 1: Backend Server Implementation

Implemented core backend functionality:
- WebAuthn authentication (registration/login)
- WebSocket authentication via session tokens
- Prekey management with database integration
- Message persistence and delivery tracking

### Session 2: Web Client Integration

Implemented web client features:
- WebAuthn API client for registration/login
- Session storage in Zustand store
- Token-based WebSocket authentication
- Encrypted messaging with WASM crypto

### Session 3: WASM Crypto Build

Implemented WASM bindings for Signal Protocol:
- Created `crates/chai-crypto/src/wasm.rs` with wasm-bindgen bindings
- Exposed CryptoManager for JavaScript use
- Built WASM module with wasm-pack
- Integrated into web client at `apps/web/wasm/`
- Updated wasm.ts wrapper for actual WASM module

### What's Complete Now ✅

| Component | Status |
|-----------|--------|
| Signal Protocol crypto (chai-crypto) | Production-ready with tests |
| **WASM bindings for crypto** | **Complete** |
| Database schema & migrations | Complete |
| Database query functions | Complete |
| WebAuthn authentication | Complete |
| WebSocket authentication | Complete |
| Prekey database integration | Complete |
| Message persistence | Complete |
| Web client auth pages | Complete |
| Web client WebSocket | Complete |
| **Web client WASM integration** | **Complete** |
| Chat messaging UI | Complete |
| **User search/discovery** | **Complete** |
| **CLI WebSocket connection** | **Complete** |
| **Integration tests** | **Complete** |

### Session 4: User Search/Discovery (2025-12-25)

Implemented user search feature:
- Added `search_by_username` database query in `db/users.rs`
- Created `handlers/users.rs` with search and profile endpoints
- Added `/users/search` and `/users/:user_id` routes
- Created `apps/web/src/lib/api/users.ts` API client
- Built new chat page at `/chat/new` with debounced search UI
- Updated chat layout to use real store data

### Session 5: CLI WebSocket Integration (2025-12-25)

Implemented CLI WebSocket connection:
- Added session token storage to CLI config
- Made WebSocket client cloneable with Arc<Mutex>
- Wired up connection with token authentication
- Implemented message sending/receiving handlers
- Added `:connect`, `:disconnect`, `:chat username` commands
- Updated UI to use per-conversation message storage

### Session 6: Integration Tests (2025-12-25)

Implemented comprehensive integration test suite:
- Created lib.rs to expose server modules for testing
- Built test server wrapper with random port binding
- Added test utilities for creating/cleaning up test users
- 9 integration tests covering:
  - Health check endpoint
  - User search authentication
  - User search with valid auth
  - User search with no results
  - User profile retrieval
  - WebSocket token requirement
  - WebSocket with valid token
  - Registration duplicate username rejection

### What's Still Incomplete 🚧

| Component | Status | Priority |
|-----------|--------|----------|
| CLI login command | Uses stored token | **LOW** |
| E2E encryption tests | Not started | **MEDIUM** |

## Commits Made This Session

```
aae92a6 feat(crypto): add WASM bindings and integrate with web client
796fc4b feat(web): integrate WebAuthn auth and E2E encrypted messaging
49aa4b9 feat(server): implement WebAuthn auth, WebSocket auth, and message persistence
```

## Key Files

### WASM Crypto
- `crates/chai-crypto/src/wasm.rs` - WASM bindings
- `apps/web/wasm/` - Compiled WASM module
- `apps/web/src/lib/crypto/wasm.ts` - TypeScript wrapper

### Backend
- `crates/chai-server/src/handlers/auth.rs` - WebAuthn
- `crates/chai-server/src/handlers/users.rs` - User search/profile
- `crates/chai-server/src/ws/handler.rs` - WebSocket auth
- `crates/chai-server/src/ws/message.rs` - Message handling
- `crates/chai-server/src/db/` - Database modules

### Web Client
- `apps/web/src/lib/api/auth.ts` - Auth API client
- `apps/web/src/lib/api/users.ts` - User search API client
- `apps/web/src/lib/ws/client.ts` - WebSocket client
- `apps/web/src/app/auth/` - Auth pages
- `apps/web/src/app/(chat)/` - Chat pages
- `apps/web/src/app/(chat)/new/page.tsx` - New conversation with user search

## Build Commands

```bash
# Build WASM module
pnpm build:wasm

# Start development
pnpm dev              # Web client (port 3000)
pnpm server:dev       # Rust server (port 8080)

# Run tests
cargo test            # Rust tests
pnpm test             # TypeScript tests
```

## Next Steps (Priority Order)

1. **E2E encryption tests** - Test Signal Protocol flows
2. **CLI login command** - Allow login from CLI
3. **Security audit** - Before production deployment

## Development Notes

- Server runs on port 8080, web client on port 3000
- WebSocket URL: `ws://localhost:8080/ws?token=<session_token>`
- WASM module at `@/wasm/chai_crypto` (path alias in tsconfig)
- All crypto and backend tests passing

## Session Continuity

When continuing work:
1. Check this file for current priorities
2. Start with highest priority incomplete item
3. Update this file after significant progress
4. Run `cargo test` and `pnpm tsc --noEmit` before committing
