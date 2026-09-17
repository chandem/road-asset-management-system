-- Maintenance planning reference schema
-- The canonical full schema is database/schema.sql.
CREATE TABLE maintenance_plans (
    plan_id BIGSERIAL PRIMARY KEY,
    plan_year INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    budget NUMERIC(14,2),
    start_date DATE,
    end_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (plan_year >= 2000 AND plan_year <= 2100),
    CHECK (budget IS NULL OR budget >= 0),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CHECK (status IN ('draft', 'approved', 'in progress', 'completed', 'cancelled'))
);

ALTER TABLE maintenance_activities
    ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES maintenance_plans(plan_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_activities_plan
    ON maintenance_activities (plan_id);
