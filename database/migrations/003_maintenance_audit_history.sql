-- RAMS migration 003
-- Track who changed maintenance activities, when, and what values changed.

SET search_path TO rams, public;

CREATE TABLE IF NOT EXISTS maintenance_history (
    history_id BIGSERIAL PRIMARY KEY,
    maintenance_id BIGINT NOT NULL REFERENCES maintenance_activities(maintenance_id) ON DELETE CASCADE,
    changed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    CHECK (action IN ('created', 'updated', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_history_maintenance
    ON maintenance_history (maintenance_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_history_changed_by
    ON maintenance_history (changed_by);
