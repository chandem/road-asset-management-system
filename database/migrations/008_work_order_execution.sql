SET search_path TO rams, public;

CREATE TABLE IF NOT EXISTS work_order_executions (
    execution_id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL UNIQUE REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    crew TEXT,
    equipment TEXT,
    materials TEXT,
    planned_quantity NUMERIC(14,3),
    actual_quantity NUMERIC(14,3),
    quantity_unit VARCHAR(50),
    actual_cost NUMERIC(14,2),
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
    CHECK (planned_quantity IS NULL OR planned_quantity >= 0),
    CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
    CHECK (actual_cost IS NULL OR actual_cost >= 0),
    CHECK (gps_latitude IS NULL OR gps_latitude BETWEEN -90 AND 90),
    CHECK (gps_longitude IS NULL OR gps_longitude BETWEEN -180 AND 180)
);
