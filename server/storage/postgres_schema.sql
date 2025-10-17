-- Multi-tenant control plane schema for Postgres
-- Client devices keep SQLite for encrypted vault data

-- Users table (authentication and account management)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash BYTEA NOT NULL,  -- PBKDF2 hash for login (NOT master password!)
    salt BYTEA NOT NULL,            -- Salt for password_hash
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    email_verified BOOLEAN DEFAULT FALSE
);

-- Devices per user (trusted device circle)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    device_type VARCHAR(50),        -- 'desktop', 'mobile', 'extension', 'web'
    public_key BYTEA,               -- Ed25519 public key for device verification
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Sync state per user per zone
CREATE TABLE IF NOT EXISTS sync_state (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone VARCHAR(100) NOT NULL DEFAULT 'default',
    gencount BIGINT NOT NULL DEFAULT 0,
    digest BYTEA,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, zone)
);

-- Layer 1: Encrypted cryptographic keys (server stores encrypted blobs, cannot decrypt)
CREATE TABLE IF NOT EXISTS crypto_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_uuid UUID NOT NULL,
    zone VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- Key metadata
    key_class SMALLINT NOT NULL,    -- 0=Symmetric, 1=Public, 2=Private
    key_type SMALLINT NOT NULL,     -- 0=AES256GCM, 1=Ed25519, 2=X25519
    label VARCHAR(255),
    application_label VARCHAR(255),
    access_group VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- Encrypted key data
    data BYTEA NOT NULL,            -- Encrypted key material
    
    -- Usage flags (bitfield or JSON)
    usage_flags JSONB NOT NULL,     -- {encrypt, decrypt, wrap, unwrap, sign, verify, derive}
    
    -- Sync metadata
    gencount BIGINT NOT NULL,
    tombstone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, item_uuid, zone)
);

-- Layer 2: Credential metadata (references crypto_keys for actual passwords)
CREATE TABLE IF NOT EXISTS credential_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_uuid UUID NOT NULL,
    zone VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- Credential information
    server VARCHAR(500) NOT NULL,
    account VARCHAR(255) NOT NULL,
    protocol SMALLINT NOT NULL DEFAULT 0,
    port INTEGER NOT NULL DEFAULT 443,
    path VARCHAR(1000),
    label VARCHAR(255),
    access_group VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- References to crypto_keys
    password_key_uuid UUID NOT NULL,
    metadata_key_uuid UUID,
    
    -- Sync metadata
    gencount BIGINT NOT NULL,
    tombstone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, item_uuid, zone)
);

-- Layer 3: Sync records (encrypted blobs for syncing)
CREATE TABLE IF NOT EXISTS sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_uuid UUID NOT NULL,
    zone VARCHAR(100) NOT NULL DEFAULT 'default',
    parent_key_uuid UUID,           -- For key hierarchy
    
    -- Encrypted data
    wrapped_key BYTEA NOT NULL,     -- Content key encrypted with master key
    enc_item BYTEA NOT NULL,        -- Item data encrypted with content key
    enc_version SMALLINT NOT NULL DEFAULT 1,
    
    -- Context for multi-context support
    context_id VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- Sync metadata
    gencount BIGINT NOT NULL,
    tombstone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, item_uuid, zone)
);

-- Refresh tokens for JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_keys_user_gencount ON crypto_keys(user_id, gencount);
CREATE INDEX IF NOT EXISTS idx_crypto_keys_user_zone ON crypto_keys(user_id, zone);
CREATE INDEX IF NOT EXISTS idx_credential_metadata_user_gencount ON credential_metadata(user_id, gencount);
CREATE INDEX IF NOT EXISTS idx_credential_metadata_user_zone ON credential_metadata(user_id, zone);
CREATE INDEX IF NOT EXISTS idx_credential_metadata_server ON credential_metadata(user_id, server);
CREATE INDEX IF NOT EXISTS idx_sync_records_user_gencount ON sync_records(user_id, gencount);
CREATE INDEX IF NOT EXISTS idx_sync_records_user_zone ON sync_records(user_id, zone);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crypto_keys_updated_at BEFORE UPDATE ON crypto_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credential_metadata_updated_at BEFORE UPDATE ON credential_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_records_updated_at BEFORE UPDATE ON sync_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample comment explaining architecture
COMMENT ON TABLE users IS 'User accounts for authentication. Master password NEVER stored here.';
COMMENT ON TABLE crypto_keys IS 'Layer 1: Encrypted cryptographic keys used to encrypt passwords. Server cannot decrypt.';
COMMENT ON TABLE credential_metadata IS 'Layer 2: Credential metadata that references crypto_keys for actual password data.';
COMMENT ON TABLE sync_records IS 'Layer 3: Encrypted sync records for device synchronization. Triple-layer encryption.';
COMMENT ON COLUMN sync_records.wrapped_key IS 'Content key wrapped with user master key (client-side only)';
COMMENT ON COLUMN sync_records.enc_item IS 'Item data encrypted with content key (layered encryption)';
