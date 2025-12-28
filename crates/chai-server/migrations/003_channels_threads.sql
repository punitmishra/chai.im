-- Channels and message threading for Slack-like functionality

-- Add channel features to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS channel_type VARCHAR(20) DEFAULT 'channel';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS topic TEXT;

-- Message threading support for direct messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latest_reply_at TIMESTAMPTZ;

-- Message threading support for group messages
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES group_messages(id);
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS latest_reply_at TIMESTAMPTZ;

-- Thread participants for notifications (direct message threads)
CREATE TABLE IF NOT EXISTS thread_participants (
    thread_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

-- Thread participants for group message threads
CREATE TABLE IF NOT EXISTS group_thread_participants (
    thread_id UUID REFERENCES group_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

-- Indexes for efficient thread queries
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_count ON messages(reply_count) WHERE reply_count > 0;
CREATE INDEX IF NOT EXISTS idx_group_messages_thread ON group_messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_count ON group_messages(reply_count) WHERE reply_count > 0;

-- Index for fetching thread participants
CREATE INDEX IF NOT EXISTS idx_thread_participants_user ON thread_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_group_thread_participants_user ON group_thread_participants(user_id);
