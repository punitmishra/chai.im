-- Contacts table for peer identity exchange
-- Stores contact relationships between users

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias VARCHAR(64),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only add the same contact once
    CONSTRAINT unique_contact UNIQUE (user_id, contact_user_id),
    -- Cannot add yourself as a contact
    CONSTRAINT no_self_contact CHECK (user_id != contact_user_id)
);

-- Index for fast contact lookups by user
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- Index for looking up who has added a user as contact
CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON contacts(contact_user_id);
