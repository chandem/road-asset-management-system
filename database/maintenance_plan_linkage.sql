-- Maintenance plan linkage
-- Canonical full schema remains in database/schema.sql.
ALTER TABLE maintenance_activities
    ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES maintenance_plans(plan_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_activities_plan
    ON maintenance_activities (plan_id);
