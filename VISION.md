# Chai.im: The Future of Private Communication

## What Makes Chai Different

Chai.im isn't just another messaging app. It's a **cryptographically secure communication platform** built from the ground up with three non-negotiable principles:

1. **True End-to-End Encryption** - Your messages are encrypted before they leave your device. Not even we can read them.
2. **Zero Trust Architecture** - We assume the server is compromised. Your security doesn't depend on trusting us.
3. **AI That Stays Private** - AI assistance that runs locally, never seeing your unencrypted data.

---

## The Security Model

### Signal Protocol Implementation

Chai uses the same encryption protocol trusted by security researchers worldwide:

```
┌─────────────────────────────────────────────────────────────────┐
│                        KEY EXCHANGE (X3DH)                       │
├─────────────────────────────────────────────────────────────────┤
│  Alice                                              Bob          │
│    │                                                  │          │
│    ├──── Identity Key (long-term) ────────────────────┤          │
│    ├──── Signed Prekey (medium-term) ─────────────────┤          │
│    ├──── Ephemeral Key (one-time) ────────────────────┤          │
│    │                                                  │          │
│    │     4 Diffie-Hellman operations create           │          │
│    │     a shared secret known only to both           │          │
│    │                                                  │          │
└─────────────────────────────────────────────────────────────────┘
```

### Double Ratchet Protocol

Every single message uses a new encryption key:

```
Message 1: Key_A1 ──► [Encrypted] ──► Key_A1 (decrypted, deleted)
Message 2: Key_A2 ──► [Encrypted] ──► Key_A2 (decrypted, deleted)
Message 3: Key_B1 ──► [Encrypted] ──► Key_B1 (decrypted, deleted)
    ...
```

**Forward Secrecy**: If a key is ever compromised, past messages remain secure.
**Future Secrecy**: If a key is compromised, future messages become secure again after a few exchanges.

---

## Authentication: Your Keys, Your Identity

### Two Ways to Secure Your Account

**1. Hardware Security Key (Recommended)**
- YubiKey, Touch ID, Face ID, Windows Hello
- Phishing-resistant authentication
- Private key never leaves your device
- Most secure option available

**2. Password-Based**
- Argon2id password hashing (memory-hard, GPU-resistant)
- Keys derived locally on your device
- Strong passwords generate strong keys
- Works anywhere, no special hardware needed

### How Key Registration Works

```
┌──────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Choose username                                           │
│        ↓                                                      │
│  2. Select auth method                                        │
│        ├── Security Key: WebAuthn creates credential          │
│        └── Password: Argon2id derives authentication key      │
│        ↓                                                      │
│  3. Generate E2E encryption keys (locally)                    │
│        ├── Identity Key (Ed25519) - your permanent identity   │
│        ├── Signed Prekey (X25519) - rotated periodically      │
│        └── One-Time Prekeys (X25519) - consumed on first msg  │
│        ↓                                                      │
│  4. Upload PUBLIC keys to server                              │
│        (Private keys NEVER leave your device)                 │
│        ↓                                                      │
│  5. Ready to communicate securely                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## What the Server Sees

| Data | Server Access |
|------|---------------|
| Your username | Yes |
| Your public keys | Yes (needed for key exchange) |
| Your private keys | **NEVER** |
| Your messages | **NEVER** (only encrypted ciphertext) |
| Who you talk to | Metadata only (sender/recipient IDs) |
| When you're online | Yes (connection status) |

**The server is a dumb pipe.** It stores encrypted blobs and facilitates key exchange. It cannot read your messages even if compelled by legal order.

---

## AI Capabilities: Private by Design

### Local-First AI

Unlike other messengers that send your data to cloud AI services, Chai's AI features run **entirely on your device**:

- **Smart Replies**: Generated locally from your conversation context
- **Message Summarization**: Processed on-device, never uploaded
- **Translation**: Local models, no external API calls
- **Search**: Encrypted index stored locally

### How It Works

```
┌─────────────────────────────────────────────────────┐
│                YOUR DEVICE                           │
│  ┌───────────────────────────────────────────────┐  │
│  │  Decrypted Messages (memory only)             │  │
│  │           ↓                                   │  │
│  │  Local AI Model (WASM/WebGPU)                 │  │
│  │           ↓                                   │  │
│  │  AI Features (suggestions, summaries)         │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ❌ No data leaves your device for AI processing    │
└─────────────────────────────────────────────────────┘
```

---

## Comparison with Other Messengers

| Feature | Chai | Signal | WhatsApp | Telegram |
|---------|------|--------|----------|----------|
| E2E Encryption | Yes | Yes | Yes* | Optional |
| Open Source | Yes | Yes | No | Partial |
| Hardware Key Auth | Yes | No | No | No |
| Local AI | Yes | No | No | No |
| Zero Trust Server | Yes | Yes | No | No |
| Metadata Protection | Strong | Strong | Weak | Weak |
| Group E2E | Yes | Yes | Yes | No |

*WhatsApp uses Signal Protocol but is closed-source, making verification impossible.

---

## The Tech Stack

**Backend**: Rust + Axum WebSocket server
- Memory-safe, zero-cost abstractions
- Async I/O for massive concurrency
- PostgreSQL for persistence

**Frontend**: Next.js 14 PWA
- Installable on any device
- Offline-capable
- WebAssembly crypto for performance

**Crypto**: Rust compiled to WebAssembly
- Signal Protocol (X3DH + Double Ratchet)
- Ed25519 signatures
- X25519 key agreement
- AES-256-GCM encryption

**Authentication**: WebAuthn + Argon2id
- Phishing-resistant
- Hardware-backed when available
- FIDO2 compliant

---

## For Developers

Chai is fully open source. Audit the code yourself:

```bash
# Clone and run locally
git clone https://github.com/chai-im/chai.im
cd chai.im

# Start the server
cargo run -p chai-server

# Start the web client
cd apps/web && pnpm dev
```

All cryptographic operations are in `crates/chai-crypto/`. Read the implementation, verify the math, trust but verify.

---

## The Bottom Line

**Chai.im is for people who refuse to compromise on privacy.**

- Your messages are mathematically secured
- Your identity is cryptographically proven
- Your AI assistant sees nothing the server doesn't
- Your keys are yours alone

This isn't privacy theater. This is real cryptographic security, built by engineers who believe private communication is a fundamental right.

---

*"The only truly secure system is one that is powered off, cast in a block of concrete and sealed in a lead-lined room with armed guards."* — Gene Spafford

*We got as close as possible while still being useful.*
