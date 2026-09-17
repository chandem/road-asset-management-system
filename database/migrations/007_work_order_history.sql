SET search_path TO rams, public;

CREATE TABLE IF NOT EXISTS work_order_history (
    history_id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    changed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    CHECK (action IN ('created', 'updated', 'issued', 'in progress', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_work_order_history_order
    ON work_order_history (work_order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_order_history_changed_by
    ON work_order_history (changed_by);
