SET search_path TO rams, public;

ALTER TABLE maintenance_activities
    ADD COLUMN IF NOT EXISTS chainage_km NUMERIC(12, 3);

CREATE INDEX IF NOT EXISTS idx_maintenance_activities_section_chainage
    ON maintenance_activities (section_id, chainage_km);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'maintenance_chainage_nonnegative'
          AND conrelid = 'rams.maintenance_activities'::regclass
    ) THEN
        ALTER TABLE maintenance_activities
            ADD CONSTRAINT maintenance_chainage_nonnegative
            CHECK (chainage_km IS NULL OR chainage_km >= 0);
    END IF;
END $$;
