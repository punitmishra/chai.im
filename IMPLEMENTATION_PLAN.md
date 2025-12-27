# Chai.im Implementation Plan

> **Created**: Dec 26, 2025
> **Status**: Active Development
> **Goal**: Make CLI and Web clients elite, production-ready

---

## Overview

This document outlines the parallel implementation of features across both CLI and Web clients. All features maintain E2E encryption and privacy-first principles.

---

## Phase 1: Core Infrastructure (Current Sprint)

### 1.1 CLI Encryption Integration
**Owner**: Agent CLI-CRYPTO
**Priority**: Critical
**Status**: 🔴 Not Started

**Tasks**:
- [ ] Import `chai-crypto` crate in CLI
- [ ] Add session storage in `~/.config/chai-cli/sessions/`
- [ ] Implement `encrypt_message()` before send
- [ ] Implement `decrypt_message()` on receive
- [ ] Fetch prekey bundles for new conversations
- [ ] Handle session initialization (X3DH)
- [ ] Persist sessions encrypted with user password

**Files to Modify**:
- `crates/chai-cli/src/tui/app.rs` - Add encryption calls
- `crates/chai-cli/src/crypto.rs` - NEW: Crypto wrapper
- `crates/chai-cli/src/storage.rs` - NEW: Session storage

---

### 1.2 CLI Authentication Flow
**Owner**: Agent CLI-AUTH
**Priority**: Critical
**Status**: 🔴 Not Started

**Tasks**:
- [ ] Create login TUI screen
- [ ] Create register TUI screen
- [ ] Password input with hidden characters
- [ ] Call `/auth/password/login` and `/auth/password/register`
- [ ] Store session token securely
- [ ] Generate identity keys on registration
- [ ] Upload prekey bundle after registration

**Files to Create**:
- `crates/chai-cli/src/tui/screens/login.rs`
- `crates/chai-cli/src/tui/screens/register.rs`
- `crates/chai-cli/src/tui/screens/mod.rs`

---

### 1.3 Web Real-Time Features
**Owner**: Agent WEB-REALTIME
**Priority**: High
**Status**: 🔴 Not Started

**Tasks**:
- [ ] Typing indicators (client sends typing events)
- [ ] Read receipts (mark messages as read)
- [ ] Online/offline status display
- [ ] "Last seen" timestamps
- [ ] Connection quality indicator

**Protocol Messages to Add**:
```typescript
// Client -> Server
{ type: 'Typing', payload: { conversation_id: string, is_typing: boolean } }
{ type: 'MarkRead', payload: { conversation_id: string, message_id: string } }

// Server -> Client
{ type: 'UserTyping', payload: { user_id: string, conversation_id: string } }
{ type: 'MessageRead', payload: { message_id: string, read_by: string } }
{ type: 'UserStatus', payload: { user_id: string, status: 'online' | 'offline', last_seen?: number } }
```

**Files to Modify**:
- `apps/web/src/lib/ws/client.ts` - Add typing/read handlers
- `apps/web/src/store/chatStore.ts` - Add typing/read state
- `apps/web/src/app/(chat)/[conversationId]/page.tsx` - Display indicators
- `crates/chai-server/src/ws/handler.rs` - Handle new message types
- `crates/chai-protocol/src/messages.rs` - Add message types

---

### 1.4 Emoji System
**Owner**: Agent EMOJI
**Priority**: Medium
**Status**: 🔴 Not Started

**Tasks**:
- [ ] Create emoji picker component (Web)
- [ ] Standard emoji support with categories
- [ ] Custom emoji upload and storage
- [ ] Emoji autocomplete (`:smile:` syntax)
- [ ] Message reactions (👍😂❤️)
- [ ] Emoji rendering in messages
- [ ] CLI emoji display (Unicode)

**Database Schema** (SQLite for lightweight):
```sql
-- Custom emojis table
CREATE TABLE custom_emojis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,        -- :custom_name:
  image_data BLOB NOT NULL,  -- Base64 encoded image
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, name)
);

-- Message reactions table
CREATE TABLE message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,       -- Unicode or :custom_name:
  created_at INTEGER NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);
```

**Files to Create**:
- `apps/web/src/components/EmojiPicker.tsx`
- `apps/web/src/components/ReactionPicker.tsx`
- `apps/web/src/lib/emoji/index.ts`
- `apps/web/src/lib/emoji/customEmoji.ts`
- `crates/chai-server/src/db/emojis.rs`

---

### 1.5 Group Chats
**Owner**: Agent GROUP-CHAT
**Priority**: High
**Status**: 🔴 Not Started

**Architecture**: Sender Keys Protocol for efficient group encryption

**Tasks**:
- [ ] Group creation with name/avatar
- [ ] Add/remove members
- [ ] Admin roles (owner, admin, member)
- [ ] Sender key distribution
- [ ] Group message encryption/decryption
- [ ] Invite links generation
- [ ] Leave group functionality
- [ ] Group settings UI

**Database Schema**:
```sql
-- Groups table
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Group members
CREATE TABLE group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- Group sender keys (for Sender Keys Protocol)
CREATE TABLE group_sender_keys (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sender_key BLOB NOT NULL,
  key_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- Invite links
CREATE TABLE group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at INTEGER,
  max_uses INTEGER,
  uses INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

**Protocol Messages**:
```typescript
// Client -> Server
{ type: 'CreateGroup', payload: { name: string, member_ids: string[] } }
{ type: 'AddGroupMember', payload: { group_id: string, user_id: string } }
{ type: 'RemoveGroupMember', payload: { group_id: string, user_id: string } }
{ type: 'SendGroupMessage', payload: { group_id: string, ciphertext: number[], sender_key_id: number } }
{ type: 'DistributeSenderKey', payload: { group_id: string, encrypted_keys: { user_id: string, key: number[] }[] } }

// Server -> Client
{ type: 'GroupCreated', payload: { group: Group } }
{ type: 'GroupMessage', payload: { group_id: string, sender_id: string, ciphertext: number[], sender_key_id: number } }
{ type: 'GroupMemberAdded', payload: { group_id: string, user_id: string } }
{ type: 'GroupMemberRemoved', payload: { group_id: string, user_id: string } }
{ type: 'SenderKeyReceived', payload: { group_id: string, from_user: string, key: number[] } }
```

---

### 1.6 Keyboard Shortcuts
**Owner**: Agent SHORTCUTS
**Priority**: Medium
**Status**: 🔴 Not Started

**Web Shortcuts**:
| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Quick conversation switch |
| `Ctrl+/` | Show shortcuts modal |
| `Ctrl+Shift+M` | Mute conversation |
| `Ctrl+E` | Edit last message |
| `Ctrl+↑` | Edit last sent |
| `Esc` | Close modals |
| `@` | Mention autocomplete |
| `:` | Emoji autocomplete |
| `Ctrl+Enter` | Send message |
| `Ctrl+Shift+E` | Toggle emoji picker |

**CLI Shortcuts** (vim-style):
| Mode | Key | Action |
|------|-----|--------|
| Normal | `/` | Search conversations |
| Normal | `?` | Search messages |
| Normal | `1-9` | Jump to conversation |
| Normal | `Ctrl+U/D` | Scroll half-page |
| Normal | `r` | Reply to message |
| Normal | `y` | Yank (copy) message |
| Normal | `dd` | Delete message |
| Normal | `e` | Edit last message |
| Normal | `m` | Mark all read |
| Normal | `Ctrl+B` | Toggle sidebar |

**Files to Create/Modify**:
- `apps/web/src/hooks/useKeyboardShortcuts.ts`
- `apps/web/src/components/ShortcutsModal.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `crates/chai-cli/src/tui/keybindings.rs`

---

### 1.7 Message Features
**Owner**: Agent MSG-FEATURES
**Priority**: Medium
**Status**: 🔴 Not Started

**Tasks**:
- [ ] Message editing (within 5 min)
- [ ] Message deletion (for self/everyone)
- [ ] Reply/quote messages
- [ ] Forward messages
- [ ] Pin messages in conversation
- [ ] Message search (full-text)
- [ ] Link previews (Open Graph)

**Database Changes**:
```sql
-- Add to messages table
ALTER TABLE messages ADD COLUMN edited_at INTEGER;
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;
ALTER TABLE messages ADD COLUMN reply_to_id TEXT;
ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
```

---

### 1.8 UI Polish
**Owner**: Agent UI-POLISH
**Priority**: Medium
**Status**: 🔴 Not Started

**Tasks**:
- [ ] Message grouping (consecutive from same sender)
- [ ] Avatar with initials and colors
- [ ] Smooth animations (Framer Motion)
- [ ] Dark/Light mode toggle
- [ ] Compact message mode
- [ ] Customizable accent colors
- [ ] PWA install prompt
- [ ] Notification badge on favicon

---

## Database Choice: SQLite

Using SQLite for lightweight, embedded database:

**Rationale**:
- Zero configuration
- Single file database
- Perfect for message/emoji storage
- Easy backup (just copy file)
- Supports full-text search (FTS5)

**Server Integration**:
```rust
// crates/chai-server/Cargo.toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
```

**Client-Side** (Web):
Using IndexedDB (already in place) for client-side storage.

---

## File Structure After Implementation

```
crates/
├── chai-cli/
│   └── src/
│       ├── crypto.rs           # NEW: Encryption wrapper
│       ├── storage.rs          # NEW: Session/config storage
│       └── tui/
│           ├── keybindings.rs  # NEW: Vim-style bindings
│           └── screens/        # NEW: Login/register screens
│               ├── mod.rs
│               ├── login.rs
│               └── register.rs
│
├── chai-server/
│   └── src/
│       ├── db/
│       │   ├── emojis.rs       # NEW: Custom emoji queries
│       │   ├── groups.rs       # NEW: Group chat queries
│       │   └── reactions.rs    # NEW: Message reactions
│       └── handlers/
│           ├── emojis.rs       # NEW: Emoji endpoints
│           └── groups.rs       # NEW: Group endpoints
│
└── chai-protocol/
    └── src/
        └── messages.rs         # MODIFY: Add new message types

apps/web/src/
├── components/
│   ├── EmojiPicker.tsx         # NEW
│   ├── ReactionPicker.tsx      # NEW
│   ├── CommandPalette.tsx      # NEW
│   ├── ShortcutsModal.tsx      # NEW
│   ├── TypingIndicator.tsx     # NEW
│   ├── ReadReceipt.tsx         # NEW
│   └── MessageGroup.tsx        # NEW
├── hooks/
│   ├── useKeyboardShortcuts.ts # NEW
│   └── useTypingIndicator.ts   # NEW
└── lib/
    └── emoji/
        ├── index.ts            # NEW
        ├── customEmoji.ts      # NEW
        └── emojiData.ts        # NEW
```

---

## Checkpoints

### Checkpoint 1: Core Security (CLI)
- [ ] CLI can encrypt/decrypt messages
- [ ] CLI can login/register
- [ ] Sessions persisted securely

### Checkpoint 2: Real-Time Features (Web)
- [ ] Typing indicators working
- [ ] Read receipts showing
- [ ] Online status visible

### Checkpoint 3: Social Features
- [ ] Emoji picker functional
- [ ] Custom emoji upload works
- [ ] Message reactions work

### Checkpoint 4: Group Chats
- [ ] Can create groups
- [ ] Group messages encrypted
- [ ] Member management works

### Checkpoint 5: Power User
- [ ] All keyboard shortcuts work
- [ ] Message editing/deletion
- [ ] Search functional

---

## Agent Assignment

| Agent ID | Focus Area | Priority |
|----------|------------|----------|
| CLI-CRYPTO | CLI encryption integration | Critical |
| CLI-AUTH | CLI login/register screens | Critical |
| WEB-REALTIME | Typing/read/status indicators | High |
| EMOJI | Emoji picker & custom emojis | Medium |
| GROUP-CHAT | Group chat infrastructure | High |
| SHORTCUTS | Keyboard shortcuts | Medium |
| MSG-FEATURES | Edit/delete/reply/search | Medium |
| UI-POLISH | Animations/themes/PWA | Low |

---

## Success Metrics

1. **Security**: All messages E2E encrypted
2. **Performance**: <100ms message send latency
3. **Reliability**: Auto-reconnect within 5s
4. **UX**: Keyboard-navigable entirely
5. **Polish**: Smooth 60fps animations

---

*Last Updated: Dec 26, 2025*
