# Security Policy

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email security concerns to: **security@chai.im**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial Response | Within 48 hours |
| Vulnerability Assessment | Within 7 days |
| Patch Development | Depends on severity |
| Public Disclosure | After patch is deployed |

### Scope

The following are in scope for security reports:

- **chai-crypto** — Cryptographic implementation bugs
- **chai-server** — Server-side vulnerabilities
- **Authentication** — WebAuthn/FIDO2 implementation issues
- **Protocol** — Wire protocol weaknesses
- **Web Client** — XSS, CSRF, injection attacks

### Out of Scope

- Social engineering attacks
- Physical security
- Denial of service (unless trivially exploitable)
- Issues in dependencies (report to upstream)

---

## Security Model

### Encryption

Chai.im uses the **Signal Protocol** for end-to-end encryption:

```
┌─────────────────────────────────────────────────────────────┐
│                    KEY HIERARCHY                             │
├─────────────────────────────────────────────────────────────┤
│  Identity Key (Ed25519)                                      │
│    └── Signed Prekey (X25519) — Rotated periodically        │
│         └── One-Time Prekeys (X25519) — Consumed on use     │
│              └── Session Keys (Double Ratchet)              │
│                   └── Message Keys (AES-256-GCM)            │
└─────────────────────────────────────────────────────────────┘
```

### Key Agreement (X3DH)

1. Alice fetches Bob's prekey bundle from the server
2. Alice performs X3DH to derive a shared secret
3. Both parties initialize the Double Ratchet with this secret
4. One-time prekeys are consumed to prevent replay

### Message Encryption (Double Ratchet)

- **Symmetric Ratchet**: Each message uses a unique key
- **DH Ratchet**: New DH keys exchanged with each reply
- **Forward Secrecy**: Past messages can't be decrypted if keys leak
- **Post-Compromise Security**: Future messages protected after breach

### Authentication (WebAuthn/FIDO2)

- No passwords stored on server
- Hardware key required for authentication
- Resistant to phishing and credential theft
- Challenge-response prevents replay attacks

---

## Cryptographic Primitives

| Purpose | Algorithm | Library |
|---------|-----------|---------|
| Signatures | Ed25519 | ed25519-dalek |
| Key Exchange | X25519 | x25519-dalek |
| Encryption | AES-256-GCM | aes-gcm |
| Key Derivation | HKDF-SHA256 | hkdf |
| Random | OS CSPRNG | rand + getrandom |

### Why These Choices?

- **Ed25519/X25519**: Modern, fast, resistant to side-channel attacks
- **AES-256-GCM**: NIST-approved, hardware-accelerated on most CPUs
- **HKDF**: Proven secure key derivation function
- **OS CSPRNG**: Most secure random source available

---

## Threat Model

### What We Protect Against

| Threat | Protection |
|--------|------------|
| Passive Eavesdropping | E2E encryption |
| Active MITM | Cryptographic identity verification |
| Server Compromise | No plaintext on server |
| Credential Theft | Hardware-backed authentication |
| Key Compromise | Forward secrecy via ratcheting |
| Replay Attacks | Message counters + consumed prekeys |

### What We Don't Protect Against

- **Endpoint Compromise**: If your device is compromised, we can't help
- **Metadata**: We can see who talks to whom (timing, frequency)
- **Physical Attacks**: Cold boot, hardware implants, etc.
- **Legal Compulsion**: We comply with valid legal orders (but have minimal data)

---

## Security Hardening

### Server

- Runs as non-root user
- Minimal attack surface (only WebSocket port exposed)
- Database credentials via environment variables
- TLS termination at edge (Fly.io)
- Rate limiting on all endpoints

### Client

- WASM crypto runs in sandboxed environment
- No eval() or dynamic code execution
- Strict CSP headers
- Subresource integrity for all assets
- Secure cookie flags (HttpOnly, Secure, SameSite)

### Development

- Dependabot for dependency updates
- Cargo audit in CI
- No unsafe Rust without explicit allow + justification
- All PRs require review

---

## Audit History

> **Note**: This project is under active development. A professional security audit is planned before production deployment.

### Planned Audits

1. Cryptographic implementation review
2. Protocol security analysis
3. Web application penetration test
4. Infrastructure security assessment

---

## Bug Bounty

We plan to establish a bug bounty program after the security audit is complete.

Preliminary reward guidelines:
- **Critical** (RCE, key extraction): $5,000+
- **High** (Auth bypass, crypto weakness): $1,000–$5,000
- **Medium** (XSS, info disclosure): $250–$1,000
- **Low** (Minor issues): Recognition + swag

---

## Contact

- **Security Issues**: security@chai.im
- **General Questions**: hello@chai.im
- **Discord**: https://discord.gg/6hXkKcTmvH
