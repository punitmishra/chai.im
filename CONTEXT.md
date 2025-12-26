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

### Backend Server Implementation

The following critical components have been implemented:

1. **WebAuthn Authentication** (`crates/chai-server/src/handlers/auth.rs`)
   - Full registration flow (start/complete)
   - Full login flow (start/complete)
   - Session token generation and hashing
   - Database integration for users, credentials, sessions

2. **WebSocket Authentication** (`crates/chai-server/src/ws/handler.rs`)
   - Token-based authentication via query parameter
   - Session validation before connection upgrade
   - Proper user ID association for connections

3. **Prekey Management** (`crates/chai-server/src/handlers/prekeys.rs`)
   - GET bundle endpoint with one-time prekey consumption
   - Upload bundle endpoint with Bearer auth
   - Upload one-time prekeys endpoint with Bearer auth

4. **Message Persistence** (`crates/chai-server/src/ws/message.rs`)
   - Store messages in database on send
   - Fetch and consume prekeys from database
   - Mark messages as delivered on ACK
   - Low prekey warnings sent to users

5. **New Database Modules**
   - `db/credentials.rs` - WebAuthn credential storage
   - `db/sessions.rs` - Session token management

### What's Complete Now ✅

| Component | Status |
|-----------|--------|
| Signal Protocol crypto (chai-crypto) | Production-ready with tests |
| Database schema & migrations | Complete |
| Database query functions | Complete |
| **WebAuthn authentication** | **Complete** |
| **WebSocket authentication** | **Complete** |
| **Prekey database integration** | **Complete** |
| **Message persistence** | **Complete** |
| Web client UI & state management | Complete |
| CLI TUI framework | Complete |
| WebSocket reconnection logic | Complete |

### What's Still Incomplete 🚧

| Component | Status | Priority |
|-----------|--------|----------|
| Web client encryption workflow | Missing WASM decryption | **HIGH** |
| CLI WebSocket connection | Mock data only | **MEDIUM** |
| Web client auth integration | UI exists, API calls needed | **MEDIUM** |

## Remaining TODO Locations

### Web Client (apps/web)

**`src/app/auth/register/page.tsx`**:
- Call WebAuthn APIs for registration

**`src/app/auth/login/page.tsx`**:
- Call WebAuthn APIs for login

**`src/app/(chat)/[conversationId]/page.tsx`**:
- Line 69: Send via WebSocket with encryption

**`src/lib/ws/client.ts`**:
- Line 159: Decrypt message using WASM crypto

### CLI Client (chai-cli)

**`src/tui/app.rs`**:
- Line 247: Send via WebSocket
- Line 258: Connect to server
- Line 272: Process incoming messages

## Next Steps (Priority Order)

1. **Web client WebAuthn integration** - Wire up auth pages to backend
2. **Web client encryption** - Implement WASM crypto calls for encrypt/decrypt
3. **CLI WebSocket integration** - Connect terminal client to server
4. **Integration tests** - End-to-end flow testing
5. **Security audit** - Before production deployment

## Development Notes

- Using runtime SQLx queries (not macros) to avoid DATABASE_URL at compile time
- WebSocket messages use JSON via chai-protocol crate
- WASM crypto wrapper in `apps/web/src/lib/crypto/`
- All crypto tests passing
- Server compiles with minor warnings (unused variables in some handlers)

## Session Continuity

When continuing work:
1. Check this file for current priorities
2. Start with highest priority incomplete item
3. Update this file after significant progress
4. Run `cargo test` and `pnpm lint` before committing

## Files Modified This Session

- `crates/chai-server/src/handlers/auth.rs` - Complete rewrite
- `crates/chai-server/src/handlers/prekeys.rs` - Database integration
- `crates/chai-server/src/ws/handler.rs` - Authentication added
- `crates/chai-server/src/ws/message.rs` - Database integration
- `crates/chai-server/src/state.rs` - Added reg/auth state caches
- `crates/chai-server/src/db/mod.rs` - Added credentials, sessions modules
- `crates/chai-server/src/db/credentials.rs` - New file
- `crates/chai-server/src/db/sessions.rs` - New file
- `crates/chai-server/Cargo.toml` - Added sha2, rand, base64 deps
- `crates/chai-common/src/types.rs` - Added From<Uuid> impls
- `Cargo.toml` - Added base64 to workspace deps
