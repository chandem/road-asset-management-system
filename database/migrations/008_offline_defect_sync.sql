SET search_path TO rams, public;

ALTER TABLE road_defects
    ADD COLUMN IF NOT EXISTS client_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_road_defects_client_id
    ON road_defects (client_id)
    WHERE client_id IS NOT NULL;
