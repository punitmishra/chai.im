<p align="center">
  <img src="https://img.shields.io/badge/E2E_Encrypted-Signal_Protocol-00D4AA?style=for-the-badge&logo=signal" alt="Signal Protocol">
  <img src="https://img.shields.io/badge/Built_with-Rust-B7410E?style=for-the-badge&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/Frontend-Next.js_14-000000?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/Auth-FIDO2/WebAuthn-4285F4?style=for-the-badge&logo=google" alt="WebAuthn">
</p>

<h1 align="center">
  <br>
  <img src="https://raw.githubusercontent.com/punitmishra/chai.im/master/.github/chai-logo.png" alt="Chai.im" width="200">
  <br>
  Chai.im
  <br>
</h1>

<h4 align="center">Military-grade encrypted messaging. Zero compromise on privacy.</h4>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#security">Security</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Why Chai.im?

In an era of surveillance capitalism, **Chai.im** stands as a fortress for your conversations. Built from the ground up with security-first architecture, we use the same **Signal Protocol** trusted by journalists, activists, and security professionals worldwide.

> **No plaintext ever touches our servers.** Your messages are encrypted end-to-end, and even we can't read them.

---

## Features

### Cryptographic Foundation
- **Signal Protocol** — X3DH key agreement + Double Ratchet for forward secrecy
- **AES-256-GCM** — Military-grade message encryption
- **Ed25519/X25519** — Modern elliptic curve cryptography
- **Perfect Forward Secrecy** — Compromise of long-term keys doesn't expose past messages

### Authentication
- **FIDO2/WebAuthn** — Passwordless hardware key authentication
- **YubiKey Support** — First-class support for hardware security keys
- **Zero Trust** — No passwords to phish, no credentials to steal

### Experience
- **Progressive Web App** — Install on any device, works offline
- **Terminal Client** — Full-featured TUI for developers (Vim keybindings!)
- **Code Snippets** — Syntax-highlighted code sharing with 100+ languages
- **AI-Powered** — Local AI assistant (no cloud, no data leaving your device)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │   Next.js PWA   │    │   Ratatui CLI   │    │  Future iOS  │  │
│  │   (WASM Crypto) │    │  (Native Rust)  │    │   /Android   │  │
│  └────────┬────────┘    └────────┬────────┘    └──────────────┘  │
│           │                      │                                │
│           └──────────┬───────────┘                                │
│                      │ WebSocket (WSS)                            │
└──────────────────────┼───────────────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────────────┐
│                      ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Axum WebSocket Server                     │ │
│  │  ┌─────────┐  ┌──────────────┐  ┌────────────────────────┐  │ │
│  │  │  Auth   │  │   Message    │  │      Connection        │  │ │
│  │  │WebAuthn │  │   Router     │  │       Manager          │  │ │
│  │  └─────────┘  └──────────────┘  └────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      PostgreSQL                              │ │
│  │  ┌─────────┐  ┌──────────────┐  ┌────────────────────────┐  │ │
│  │  │  Users  │  │   Prekeys    │  │   Encrypted Messages   │  │ │
│  │  │ (keys)  │  │  (X3DH)      │  │     (ciphertext)       │  │ │
│  │  └─────────┘  └──────────────┘  └────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           SERVER                                  │
└───────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
chai.im/
├── crates/                      # Rust workspace
│   ├── chai-crypto/             # Signal Protocol → WASM
│   ├── chai-server/             # Axum WebSocket server
│   ├── chai-protocol/           # Wire protocol definitions
│   ├── chai-cli/                # Terminal client (Ratatui)
│   └── chai-common/             # Shared types
│
├── apps/
│   └── web/                     # Next.js 14 PWA
│       ├── src/app/             # App Router pages
│       ├── src/lib/crypto/      # WASM crypto wrapper
│       └── src/store/           # Zustand state stores
│
└── packages/
    └── typescript-config/       # Shared TS configs
```

---

## Quick Start

### Prerequisites

- **Rust** 1.75+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Node.js** 20+ with **pnpm** (`npm i -g pnpm`)
- **PostgreSQL** 15+ (or use Docker)
- **wasm-pack** (`cargo install wasm-pack`)

### Installation

```bash
# Clone the repository
git clone https://github.com/punitmishra/chai.im.git
cd chai.im

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# Run database migrations
cd crates/chai-server && sqlx migrate run

# Build WASM crypto module
pnpm build:wasm

# Start development servers
pnpm dev          # Next.js web client (port 3000)
pnpm server:dev   # Rust backend (port 8080)
```

### CLI Client

```bash
# Build and run the terminal client
cargo run -p chai-cli

# Vim-style keybindings:
# j/k     - Navigate conversations
# i       - Enter insert mode (type message)
# :       - Command mode
# :q      - Quit
```

---

## Security

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Server Compromise | E2E encryption — server only sees ciphertext |
| Man-in-the-Middle | TLS + cryptographic identity verification |
| Credential Theft | FIDO2 hardware keys — nothing to steal |
| Message Tampering | HMAC authentication on all messages |
| Metadata Leakage | Minimal logging, encrypted at rest |
| Replay Attacks | Message counters + ratcheting keys |

### Cryptographic Primitives

- **Key Agreement**: X3DH (Extended Triple Diffie-Hellman)
- **Message Encryption**: Double Ratchet with AES-256-GCM
- **Signatures**: Ed25519
- **Key Derivation**: HKDF-SHA256
- **Random Generation**: OS-provided CSPRNG

### Audit Status

> This project is under active development. A professional security audit is planned before production deployment.

---

## Deployment

### Fly.io (Recommended)

```bash
# Install Fly CLI
brew install flyctl

# Deploy
fly launch --name chai-server
fly postgres create --name chai-db
fly secrets set DATABASE_URL=postgres://...
fly deploy
```

### Docker

```bash
docker compose up -d
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PORT` | Server port (default: 8080) | No |
| `RP_ID` | WebAuthn relying party ID | Yes |
| `RP_ORIGIN` | WebAuthn origin URL | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |

---

## Development

### Build Commands

```bash
pnpm dev            # Start Next.js dev server
pnpm server:dev     # Start Rust backend
pnpm cli:dev        # Run CLI in dev mode
pnpm build          # Build everything
pnpm build:wasm     # Build WASM crypto module
pnpm test           # Run all tests
cargo test          # Run Rust tests
cargo clippy        # Lint Rust code
```

### Project Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web client development server |
| `pnpm server:dev` | Start backend with hot reload |
| `pnpm cli:dev` | Run terminal client |
| `pnpm build:wasm` | Compile Rust crypto to WebAssembly |
| `cargo test` | Run Rust unit tests |
| `cargo clippy` | Run Rust linter |

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Flow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Quality

- All Rust code must pass `cargo clippy` with no warnings
- All TypeScript must pass `pnpm lint`
- Tests are required for new features
- Security-sensitive code requires review from maintainers

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- **Signal Foundation** for the Signal Protocol specification
- **libsignal** for reference implementations
- **The Rust Community** for amazing cryptographic libraries

---

<p align="center">
  <sub>Built with paranoia by developers who value privacy.</sub>
</p>

<p align="center">
  <a href="https://discord.gg/6hXkKcTmvH">Discord</a> •
  <a href="https://chai.im">Website</a> •
  <a href="https://twitter.com/chaiim">Twitter</a>
</p>
