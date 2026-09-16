-- RAMS migration 002
-- Link maintenance activities to the defect that triggered the work.

SET search_path TO rams, public;

ALTER TABLE maintenance_activities
    ADD COLUMN IF NOT EXISTS source_defect_id BIGINT
        REFERENCES road_defects(defect_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_source_defect
    ON maintenance_activities (source_defect_id);
