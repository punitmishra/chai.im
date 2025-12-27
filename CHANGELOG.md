# Changelog

All notable changes to Chai.im will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Encryption badge** in conversation header showing E2E encryption status
- **Offline warning banner** when disconnected from server
- **Registration progress labels** (Username → Security → Complete)
- **Password hints** on login page
- **Encryption info badge** in new conversation search results
- **Group chat infrastructure** - Backend API endpoints + database migrations
- **Emoji system** - Picker with categories, search, recent emojis
- **Reaction picker** for quick message reactions
- **Typing indicator** component
- **Online status** component
- **Read receipt** component
- **Keyboard shortcuts** system with vim-style bindings
- **Mock WASM crypto** for development environment

### Changed
- Improved empty conversation state with personalized greeting ("Say hello to [name]!")
- Hardened CORS: restrict to specific `RP_ORIGIN` instead of `Any`
- Added explicit allowed methods and headers for CORS
- Enabled credentials support for authenticated requests

### Fixed
- TypeScript errors in emoji and component files
- Auth store references (`token` → `sessionToken`)
- Ref callbacks in EmojiPicker
- EmojiData type usage in ReactionPicker

### Performance
- Backend benchmarks: **16,823 req/sec** at 100 concurrent connections
- Mean latency: 5.9ms, P99: 10ms

## [0.1.0] - 2025-12-26

### Added
- Initial release with core chat functionality
- End-to-end encryption using Signal Protocol (X3DH + Double Ratchet)
- Password-based authentication with Argon2
- WebAuthn/FIDO2 authentication with security keys
- Real-time WebSocket messaging
- Self-chat ("Notes to Self") feature
- CLI client with vim keybindings
- Next.js 14 web client with App Router
- Zustand state management with persistence
- Vitest testing infrastructure (25 tests)
- PostgreSQL database with SQLx
- Fly.io deployment configuration
