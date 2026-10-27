-- =============================================================================
-- SPLITWISE CLONE: ACID RELATIONAL SCHEMA (PostgreSQL / SQLite Compatible)
-- =============================================================================

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    upi_vpa VARCHAR(120),
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    avatar_initials VARCHAR(8),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE friendships (
    id VARCHAR(64) PRIMARY KEY,
    user_a_id VARCHAR(64) NOT NULL REFERENCES users(id),
    user_b_id VARCHAR(64) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_a_id, user_b_id)
);

CREATE TABLE groups (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'Other', -- Apartment, Trip, Couple, Other
    avatar VARCHAR(16) DEFAULT '🏠',
    simplify_by_default BOOLEAN NOT NULL DEFAULT TRUE,
    default_split_strategy VARCHAR(24) NOT NULL DEFAULT 'EQUAL',
    monthly_budget DECIMAL(14, 2) DEFAULT 50000.00,
    invite_token VARCHAR(64) UNIQUE NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE TABLE expenses (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) REFERENCES groups(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'Other',
    total_amount DECIMAL(14, 2) NOT NULL CHECK (total_amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    expense_date DATE NOT NULL,
    created_by VARCHAR(64) NOT NULL REFERENCES users(id),
    split_type VARCHAR(24) NOT NULL, -- EQUAL, EXACT, PERCENT, SHARES, ADJUSTMENT
    is_payment BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_interval VARCHAR(24) DEFAULT 'none', -- none, weekly, monthly, yearly
    notes TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_users (
    id VARCHAR(64) PRIMARY KEY,
    expense_id VARCHAR(64) NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paid_share DECIMAL(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_share >= 0),
    owed_share DECIMAL(14, 2) NOT NULL DEFAULT 0.00 CHECK (owed_share >= 0),
    UNIQUE(expense_id, user_id)
);

CREATE TABLE expense_comments (
    id VARCHAR(64) PRIMARY KEY,
    expense_id VARCHAR(64) NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Event-Sourced Immutable Revision History
CREATE TABLE expense_revisions (
    id VARCHAR(64) PRIMARY KEY,
    expense_id VARCHAR(64) NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    actor_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    action_type VARCHAR(32) NOT NULL, -- CREATE, EDIT, SOFT_DELETE, RESTORE, SETTLE
    change_summary TEXT NOT NULL,
    previous_payload_json TEXT,
    new_payload_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_group ON expenses(group_id, is_deleted);
CREATE INDEX idx_expense_users_user ON expense_users(user_id);
CREATE INDEX idx_revisions_expense ON expense_revisions(expense_id);
