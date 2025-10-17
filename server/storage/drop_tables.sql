-- Drop all tables in correct order (respecting foreign key constraints)
-- Used by 'make db-reset' to recreate schema

DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS sync_records CASCADE;
DROP TABLE IF EXISTS credential_metadata CASCADE;
DROP TABLE IF EXISTS crypto_keys CASCADE;
DROP TABLE IF EXISTS sync_state CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
