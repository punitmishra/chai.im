# Chai CLI Demo

## TUI Screens

### 1. Welcome Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                                                                             │
│          ┌─────────────────────────── Welcome ───────────────────────────┐  │
│          │                                                               │  │
│          │    ☕ Chai.im                                                 │  │
│          │                                                               │  │
│          │    Secure, end-to-end encrypted messaging                    │  │
│          │                                                               │  │
│          │                                                               │  │
│          │    [R] Register new account                                  │  │
│          │                                                               │  │
│          │    [L] Login with recovery phrase                            │  │
│          │                                                               │  │
│          │                                                               │  │
│          │    Press Ctrl+Q to quit                                      │  │
│          │                                                               │  │
│          └───────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                                                             │
│              Welcome to Chai! Press 'r' to register or 'l' to login         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Register Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                                                                             │
│          ┌─────────────────────────── Register ──────────────────────────┐  │
│          │                                                               │  │
│          │    Create Account                                             │  │
│          │                                                               │  │
│          │    Choose a username (alphanumeric + underscore):            │  │
│          │                                                               │  │
│          │    > alice_smith_                                            │  │
│          │                                                               │  │
│          │    Press Enter to continue, ESC to go back                   │  │
│          │                                                               │  │
│          └───────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                                                             │
│                                 Enter a username                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Mnemonic Display Screen (After Registration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌────────────────────────── Recovery Phrase ──────────────────────────┐  │
│    │                                                                     │  │
│    │    Your Recovery Phrase                                             │  │
│    │                                                                     │  │
│    │    ⚠️  Write these words down and keep them safe!                   │  │
│    │    Anyone with this phrase can access your account.                │  │
│    │                                                                     │  │
│    │     1. abandon       7. liberty      13. puzzle      19. silver    │  │
│    │     2. ability       8. light        14. quality     20. simple    │  │
│    │     3. abstract      9. long         15. quantum     21. since     │  │
│    │     4. academy      10. loop         16. rabbit      22. size      │  │
│    │     5. access       11. lunar        17. random      23. sketch    │  │
│    │     6. acoustic     12. lyrics       18. render      24. slender   │  │
│    │                                                                     │  │
│    │    Press Enter when you've saved your phrase                       │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│         Write down your recovery phrase! Press Enter when ready.            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Login Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                                                                             │
│          ┌─────────────────────────── Login ─────────────────────────────┐  │
│          │                                                               │  │
│          │    Login                                                      │  │
│          │                                                               │  │
│          │    Enter your username:                                      │  │
│          │                                                               │  │
│          │    > alice_smith_                                            │  │
│          │                                                               │  │
│          │    Press Enter to continue, ESC to go back                   │  │
│          │                                                               │  │
│          └───────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                                                             │
│                              Enter your username                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Mnemonic Input Screen (Login)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌────────────────────────── Recovery Phrase ──────────────────────────┐  │
│    │                                                                     │  │
│    │    Enter Recovery Phrase                                            │  │
│    │                                                                     │  │
│    │    Words entered: 18/24                                            │  │
│    │                                                                     │  │
│    │    abandon ability abstract academy access acoustic liberty light   │  │
│    │    long loop lunar lyrics puzzle quality quantum rabbit random      │  │
│    │    render                                                           │  │
│    │                                                                     │  │
│    │    Separate words with spaces. Press Enter when done.              │  │
│    │                                                                     │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                         Enter your 24-word recovery phrase                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Main Chat Screen

```
┌──────────────────────────────┬──────────────────────────────────────────────┐
│┌────────────────────────────┐│┌────────────────────────────────────────────┐│
││  ☕ alice_smith             ││ bob_jones (typing...)                       ││
│└────────────────────────────┘│└────────────────────────────────────────────┘│
│┌──────────── Chats ─────────┐│┌──────────────── Messages ──────────────────┐│
││ ● bob_jones ...         (2)││bob_jones [10:32 AM]                         ││
││ ○ charlie                  ││  Hey! How's the new encryption working?     ││
││ ○ dev_team                 ││                                              ││
││                            ││alice_smith [10:33 AM] ✓✓                     ││
││                            ││  Great! End-to-end encrypted now 🔐          ││
││                            ││                                              ││
││                            ││bob_jones [10:34 AM]                         ││
││                            ││  Perfect! Let me test the typing indicator  ││
││                            ││                                              ││
││                            ││bob_jones is typing...                       ││
│└────────────────────────────┘│└────────────────────────────────────────────┘│
│┌────────────────────────────┐│┌──── Type message (ESC to cancel) ──────────┐│
││ Connected                  │││ Sounds good! Let me know if you need help_ ││
│└────────────────────────────┘│└────────────────────────────────────────────┘│
└──────────────────────────────┴──────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Mode | Key | Action |
|------|-----|--------|
| Normal | `i` | Enter editing mode |
| Normal | `j` / `↓` | Next conversation |
| Normal | `k` / `↑` | Previous conversation |
| Normal | `g` | First conversation |
| Normal | `G` | Last conversation |
| Normal | `:` | Command mode |
| Editing | `ESC` | Exit to normal mode |
| Editing | `Enter` | Send message |
| Command | `ESC` | Exit to normal mode |
| Command | `Enter` | Execute command |

## Commands

| Command | Description |
|---------|-------------|
| `:c` or `:connect` | Connect to server |
| `:dc` or `:disconnect` | Disconnect from server |
| `:chat <username>` | Start chat with user |
| `:logout` | Sign out and return to welcome |
| `:help` or `:h` | Show help |
| `:q` or `:quit` | Quit application |

## Message Status Icons

| Icon | Status |
|------|--------|
| ○ | Sending |
| ✓ | Sent |
| ✓✓ | Delivered/Read |

## Typing Indicators

- Shows `...` next to username in conversation list
- Shows `(typing...)` in chat header
- Shows "username is typing..." at bottom of messages
- Auto-clears after 5 seconds of inactivity
