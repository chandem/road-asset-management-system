-- RAMS database schema
-- PostgreSQL + PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS rams;
SET search_path TO rams, public, extensions;

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
    password_hash VARCHAR(255),
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
    section_code VARCHAR(50) NOT NULL,
    start_chainage NUMERIC(12,3) NOT NULL,
    end_chainage NUMERIC(12,3) NOT NULL,
    length_km NUMERIC(12,3) GENERATED ALWAYS AS (end_chainage - start_chainage) STORED,
    surface_type VARCHAR(50),
    condition_rating NUMERIC(5,2),
    geometry geometry(LineString, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (road_id, section_code),
    CHECK (end_chainage >= start_chainage),
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE chainage_points (
    chainage_point_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT NOT NULL REFERENCES roads(road_id) ON DELETE CASCADE,
    chainage NUMERIC(12,3) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    elevation_m NUMERIC(10,3),
    utm_zone VARCHAR(20),
    utm_easting NUMERIC(15,3),
    utm_northing NUMERIC(15,3),
    geometry geometry(Point, 4326),
    UNIQUE (road_id, chainage)
);

CREATE TABLE road_assets (
    asset_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT NOT NULL REFERENCES roads(road_id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    asset_type VARCHAR(50) NOT NULL,
    asset_code VARCHAR(100),
    chainage_km NUMERIC(12,3),
    condition_rating NUMERIC(5,2),
    criticality INTEGER NOT NULL DEFAULT 3,
    commissioning_year INTEGER,
    expected_life_years INTEGER,
    replacement_cost NUMERIC(14,2),
    replacement_threshold NUMERIC(5,2) NOT NULL DEFAULT 40,
    description TEXT,
    geometry geometry(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100)),
    CHECK (criticality BETWEEN 1 AND 5),
    CHECK (expected_life_years IS NULL OR expected_life_years >= 1),
    CHECK (replacement_cost IS NULL OR replacement_cost >= 0),
    CHECK (replacement_threshold BETWEEN 0 AND 100)
);

CREATE TABLE bridges (
    bridge_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT NOT NULL REFERENCES roads(road_id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    bridge_code VARCHAR(100) NOT NULL UNIQUE,
    chainage_km NUMERIC(12,3),
    length_m NUMERIC(12,3),
    width_m NUMERIC(12,3),
    condition_rating NUMERIC(5,2),
    geometry geometry(Point, 4326),
    description TEXT,
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE culverts (
    culvert_id BIGSERIAL PRIMARY KEY,
    road_id BIGINT NOT NULL REFERENCES roads(road_id) ON DELETE CASCADE,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    culvert_code VARCHAR(100) NOT NULL UNIQUE,
    chainage_km NUMERIC(12,3),
    condition_rating NUMERIC(5,2),
    geometry geometry(Point, 4326),
    description TEXT,
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE inspections (
    inspection_id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES road_sections(section_id) ON DELETE CASCADE,
    inspector_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    client_id VARCHAR(100) UNIQUE,
    inspection_date DATE NOT NULL,
    condition_rating NUMERIC(5,2),
    weather VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE road_defects (
    defect_id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT REFERENCES inspections(inspection_id) ON DELETE SET NULL,
    asset_id BIGINT REFERENCES road_assets(asset_id) ON DELETE SET NULL,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    client_id VARCHAR(100) UNIQUE,
    defect_type VARCHAR(100) NOT NULL,
    severity VARCHAR(30),
    chainage_km NUMERIC(12,3),
    length_m NUMERIC(12,3),
    width_m NUMERIC(12,3),
    depth_mm NUMERIC(12,3),
    description TEXT,
    geometry geometry(Point, 4326),
    detected_by VARCHAR(30) NOT NULL DEFAULT 'manual'
);

CREATE INDEX idx_road_defects_asset ON road_defects(asset_id);

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

CREATE TABLE maintenance_activities (
    maintenance_id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT REFERENCES road_assets(asset_id) ON DELETE SET NULL,
    road_id BIGINT REFERENCES roads(road_id) ON DELETE SET NULL,
    section_id BIGINT REFERENCES road_sections(section_id) ON DELETE SET NULL,
    source_defect_id BIGINT REFERENCES road_defects(defect_id) ON DELETE SET NULL,
    plan_id BIGINT REFERENCES maintenance_plans(plan_id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    priority VARCHAR(30),
    chainage_km NUMERIC(12,3),
    planned_date DATE,
    completed_date DATE,
    estimated_cost NUMERIC(14,2),
    actual_cost NUMERIC(14,2),
    contractor VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'planned',
    description TEXT,
    CHECK (chainage_km IS NULL OR chainage_km >= 0),
    CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    CHECK (actual_cost IS NULL OR actual_cost >= 0)
);

CREATE TABLE work_orders (
    work_order_id BIGSERIAL PRIMARY KEY,
    maintenance_id BIGINT NOT NULL REFERENCES maintenance_activities(maintenance_id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    assigned_to VARCHAR(200),
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE work_order_history (
    history_id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    changed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB
);

CREATE INDEX idx_work_orders_maintenance ON work_orders (maintenance_id);
CREATE INDEX idx_work_orders_status ON work_orders (status);
CREATE INDEX idx_work_order_history_work_order ON work_order_history (work_order_id, changed_at DESC);

CREATE TABLE asset_inspections (
    asset_inspection_id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES road_assets(asset_id) ON DELETE CASCADE,
    inspection_date DATE NOT NULL,
    inspector_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    condition_rating NUMERIC(5,2),
    defect_status VARCHAR(50),
    notes TEXT,
    CHECK (condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100))
);

CREATE TABLE maintenance_history (
    history_id BIGSERIAL PRIMARY KEY,
    maintenance_id BIGINT NOT NULL REFERENCES maintenance_activities(maintenance_id) ON DELETE CASCADE,
    changed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    CHECK (action IN ('created', 'updated', 'completed', 'cancelled'))
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
CREATE INDEX idx_asset_inspections_asset_date ON asset_inspections (asset_id, inspection_date);
CREATE INDEX idx_maintenance_asset ON maintenance_activities (asset_id);
CREATE INDEX idx_maintenance_source_defect ON maintenance_activities (source_defect_id);
CREATE INDEX idx_maintenance_section_chainage ON maintenance_activities (section_id, chainage_km);
CREATE INDEX idx_maintenance_history_maintenance ON maintenance_history (maintenance_id, changed_at DESC);
CREATE INDEX idx_maintenance_history_changed_by ON maintenance_history (changed_by);
CREATE INDEX idx_maintenance_plans_year ON maintenance_plans (plan_year);
CREATE INDEX idx_maintenance_plans_status ON maintenance_plans (status);
CREATE INDEX idx_maintenance_activities_plan ON maintenance_activities (plan_id);
CREATE UNIQUE INDEX uq_inspections_client_id ON inspections (client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX uq_road_defects_client_id ON road_defects (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_users_username ON users (username);
