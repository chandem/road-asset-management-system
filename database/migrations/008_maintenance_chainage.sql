SET search_path TO rams, public;

ALTER TABLE maintenance_activities
    ADD COLUMN IF NOT EXISTS chainage_km NUMERIC(12, 3);

CREATE INDEX IF NOT EXISTS idx_maintenance_activities_section_chainage
    ON maintenance_activities (section_id, chainage_km);

ALTER TABLE maintenance_activities
    ADD CONSTRAINT maintenance_chainage_nonnegative
    CHECK (chainage_km IS NULL OR chainage_km >= 0);
