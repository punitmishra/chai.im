# Contributing to Chai.im

First off, thank you for considering contributing to Chai.im! It's people like you that make Chai.im such a great tool.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct: be respectful, inclusive, and constructive.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Environment details** (OS, browser, Rust version, etc.)
- **Screenshots/logs** if applicable

### Suggesting Features

Feature suggestions are welcome! Please include:

- **Use case**: Why is this feature needed?
- **Proposed solution**: How would it work?
- **Alternatives considered**: What else could solve this?

### Pull Requests

1. Fork the repo and create your branch from `master`
2. If you've added code, add tests
3. If you've changed APIs, update documentation
4. Ensure the test suite passes
5. Make sure your code follows the style guidelines
6. Create your pull request

## Development Setup

### Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add clippy rustfmt

# Node.js + pnpm
brew install node
npm install -g pnpm

# wasm-pack for WASM builds
cargo install wasm-pack

# PostgreSQL (optional - can use Docker)
brew install postgresql@15
```

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/chai.im.git
cd chai.im

# Install dependencies
pnpm install

# Run tests
cargo test
pnpm test

# Start development
pnpm dev          # Web client
pnpm server:dev   # Backend
```

## Style Guidelines

### Rust

```bash
# Format code
cargo fmt

# Check lints
cargo clippy -- -D warnings

# Run tests
cargo test
```

Key conventions:
- Use `snake_case` for functions and variables
- Use `CamelCase` for types and traits
- Document public APIs with `///` comments
- Prefer explicit error handling over `unwrap()`
- No `unsafe` without explicit `#[allow(unsafe_code)]` and justification

### TypeScript

```bash
# Format + lint
pnpm lint

# Type check
pnpm type-check
```

Key conventions:
- Use `camelCase` for variables and functions
- Use `PascalCase` for components and types
- Prefer `const` over `let`
- Use TypeScript strict mode
- Document complex functions with JSDoc

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(crypto): implement Double Ratchet key derivation
fix(server): handle WebSocket disconnection gracefully
docs(readme): add deployment instructions
refactor(cli): extract UI rendering into separate module
```

## Project Structure

```
chai.im/
├── crates/                     # Rust workspace
│   ├── chai-crypto/            # Cryptographic primitives
│   │   ├── src/
│   │   │   ├── keys.rs         # Key types
│   │   │   ├── x3dh.rs         # Key agreement
│   │   │   ├── ratchet.rs      # Double Ratchet
│   │   │   ├── cipher.rs       # AES-256-GCM
│   │   │   └── session.rs      # Session management
│   │   └── tests/              # Integration tests
│   │
│   ├── chai-server/            # WebSocket server
│   │   ├── src/
│   │   │   ├── handlers/       # HTTP handlers
│   │   │   ├── ws/             # WebSocket logic
│   │   │   └── db/             # Database queries
│   │   └── migrations/         # SQL migrations
│   │
│   ├── chai-protocol/          # Wire protocol
│   ├── chai-cli/               # Terminal client
│   └── chai-common/            # Shared types
│
├── apps/web/                   # Next.js frontend
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # Utilities
│   │   └── store/              # Zustand stores
│   └── public/                 # Static assets
│
└── packages/                   # Shared configs
    └── typescript-config/
```

## Testing

### Rust Tests

```bash
# Run all tests
cargo test

# Run specific crate tests
cargo test -p chai-crypto

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_x3dh_key_agreement
```

### TypeScript Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### Writing Tests

- Unit tests go in the same file as the code (Rust `#[cfg(test)]` module)
- Integration tests go in `tests/` directory
- Name tests descriptively: `test_x3dh_sender_receiver_derive_same_secret`
- Test both success and failure cases
- For crypto code, include known-answer tests

## Security Considerations

When contributing security-sensitive code:

1. **Never** commit secrets, keys, or credentials
2. **Always** use constant-time comparisons for secrets
3. **Never** log sensitive data (keys, plaintext, etc.)
4. **Always** validate and sanitize inputs
5. **Always** use parameterized queries for database access
6. **Always** use secure random for cryptographic operations

Security-sensitive changes require review from a maintainer with security expertise.

## Documentation

- Update README.md for user-facing changes
- Update CLAUDE.md for architecture changes
- Add inline comments for complex logic
- Document public APIs with doc comments

## Getting Help

- **Discord**: https://discord.gg/6hXkKcTmvH
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Project website

Thank you for contributing!
