SET search_path TO rams, public;

CREATE TABLE IF NOT EXISTS work_orders (
    work_order_id BIGSERIAL PRIMARY KEY,
    maintenance_id BIGINT NOT NULL REFERENCES maintenance_activities(maintenance_id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    assigned_to VARCHAR(200),
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('draft', 'issued', 'in progress', 'completed', 'cancelled')),
    CHECK (due_date IS NULL OR due_date >= issue_date)
);

CREATE INDEX IF NOT EXISTS idx_work_orders_maintenance
    ON work_orders (maintenance_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status
    ON work_orders (status);
CREATE INDEX IF NOT EXISTS idx_work_orders_due_date
    ON work_orders (due_date);
