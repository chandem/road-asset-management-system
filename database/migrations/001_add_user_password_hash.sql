-- RAMS migration 001
-- Add password storage for JWT authentication.
-- Run once against an existing RAMS database.

SET search_path TO rams, public;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
