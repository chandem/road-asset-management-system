-- RAMS PostgreSQL/PostGIS database schema
-- Road Asset Management System

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS rams;
SET search_path TO rams, public;

CREATE TABLE organizations (
    organization_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations(organization_id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'inspector',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roads (
    road_id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations(organization_id) ON DELETE SET NULL,
    road_code VARCHAR(50) NOT NULL UNIQUE,
    road_name VARCHAR(200) NOT NULL,
    road_class VARCHAR(50),
    surface_type VARCHAR(50),
    start_location VARCHAR(200),
    end_location VARCHAR(200),
    total_length_km NUMERIC(12,3),
    geometry geometry(LineString, 4326),
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (total_length_km IS NULL OR total_length_km >= 0)
);

CREATE TABLE road_sections (
    section_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT NOT NULL REFERENCES roads(road_id) ON DELETE CASCADE,
    section_code VARCHAR(80) NOT NULL UNIQUE,
    start_chainage NUMERIC(12,3) NOT NULL,
    end_chainage NUMERIC(12,3) NOT NULL,
    length_km NUMERIC(12,3),
    surface_type VARCHAR(50),
    condition_rating NUMERIC(5,2),
    geometry geometry(LineString, 4326),
    CHECK (end_chainage >= start_chainage),
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE chainage_points (
    point_id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES road_sections(section_id) ON DELETE CASCADE,
    chainage_km NUMERIC(12,3) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    elevation_m DOUBLE PRECISION,
    utm_zone INTEGER,
    utm_easting DOUBLE PRECISION,
    utm_northing DOUBLE PRECISION,
    geometry geometry(Point, 4326),
    UNIQUE (section_id, chainage_km)
);

CREATE TABLE road_assets (
    asset_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT REFERENCES roads(road_id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    asset_type VARCHAR(50) NOT NULL,
    asset_code VARCHAR(100) UNIQUE,
    chainage_km NUMERIC(12,3),
    description TEXT,
    condition_rating NUMERIC(5,2),
    geometry geometry(Geometry, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE bridges (
    bridge_id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL UNIQUE REFERENCES road_assets(asset_id) ON DELETE CASCADE,
    bridge_name VARCHAR(200),
    bridge_type VARCHAR(100),
    length_m NUMERIC(10,2),
    width_m NUMERIC(10,2),
    number_of_spans INTEGER,
    structural_condition VARCHAR(50)
);

CREATE TABLE culverts (
    culvert_id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL UNIQUE REFERENCES road_assets(asset_id) ON DELETE CASCADE,
    culvert_type VARCHAR(100),
    diameter_mm NUMERIC(10,2),
    width_m NUMERIC(10,2),
    height_m NUMERIC(10,2),
    condition VARCHAR(50)
);

CREATE TABLE inspections (
    inspection_id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES road_sections(section_id) ON DELETE CASCADE,
    inspector_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    inspection_date DATE NOT NULL,
    condition_rating NUMERIC(5,2),
    weather VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE road_defects (
    defect_id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    defect_type VARCHAR(100) NOT NULL,
    severity VARCHAR(30),
    chainage_km NUMERIC(12,3),
    length_m NUMERIC(10,2),
    width_m NUMERIC(10,2),
    depth_mm NUMERIC(10,2),
    description TEXT,
    geometry geometry(Geometry, 4326),
    detected_by VARCHAR(30) NOT NULL DEFAULT 'manual'
);

CREATE TABLE maintenance_activities (
    maintenance_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT REFERENCES roads(road_id) ON DELETE SET NULL,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    priority VARCHAR(30),
    planned_date DATE,
    completed_date DATE,
    estimated_cost NUMERIC(14,2),
    actual_cost NUMERIC(14,2),
    contractor VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'planned',
    description TEXT,
    CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    CHECK (actual_cost IS NULL OR actual_cost >= 0)
);

CREATE TABLE gps_tracks (
    track_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT REFERENCES roads(road_id) ON DELETE CASCADE,
    recorded_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50),
    geometry geometry(LineString, 4326),
    length_km NUMERIC(12,3)
);

CREATE TABLE images (
    image_id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT REFERENCES inspections(inspection_id) ON DELETE SET NULL,
    defect_id BIGINT REFERENCES road_defects(defect_id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    captured_at TIMESTAMPTZ,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geometry geometry(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_detection_results (
    detection_id BIGSERIAL PRIMARY KEY,
    image_id BIGINT NOT NULL REFERENCES images(image_id) ON DELETE CASCADE,
    model_name VARCHAR(200) NOT NULL,
    model_version VARCHAR(100),
    defect_type VARCHAR(100) NOT NULL,
    confidence NUMERIC(6,5),
    bounding_box JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX idx_roads_geometry ON roads USING GIST (geometry);
CREATE INDEX idx_sections_geometry ON road_sections USING GIST (geometry);
CREATE INDEX idx_chainage_geometry ON chainage_points USING GIST (geometry);
CREATE INDEX idx_assets_geometry ON road_assets USING GIST (geometry);
CREATE INDEX idx_defects_geometry ON road_defects USING GIST (geometry);
CREATE INDEX idx_gps_tracks_geometry ON gps_tracks USING GIST (geometry);
CREATE INDEX idx_images_geometry ON images USING GIST (geometry);
CREATE INDEX idx_sections_road ON road_sections (road_id);
CREATE INDEX idx_inspections_section ON inspections (section_id);
CREATE INDEX idx_defects_section ON road_defects (section_id);
CREATE INDEX idx_maintenance_section ON maintenance_activities (section_id);
