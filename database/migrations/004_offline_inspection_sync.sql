SET search_path TO rams, public;

ALTER TABLE inspections
    ADD COLUMN IF NOT EXISTS client_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inspections_client_id
    ON inspections (client_id)
    WHERE client_id IS NOT NULL;
