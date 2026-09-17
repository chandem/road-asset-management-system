"""Load sample RAMS data for local demos and development.

Idempotent: safe to run multiple times. Skips entities that already exist
(matched by username / road_code / section_code).

Usage (from backend/):

    export DATABASE_URL=postgresql+psycopg://rams_user:change_me@localhost:5432/rams
    export JWT_SECRET_KEY=your-secret-at-least-32-characters-long
    export PYTHONPATH=.
    python scripts/seed_demo_data.py

Docker:

    docker compose exec backend python scripts/seed_demo_data.py

Default demo password for seeded users: DemoPass123!
"""
from __future__ import annotations

from datetime import date

from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity
from app.models.road import Road
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.models.user import User

DEMO_PASSWORD = "DemoPass123!"

# Approximate corridor near Addis Ababa (lon/lat WGS84)
ROAD_A_LINE = "LINESTRING(38.75 9.00, 38.85 9.02, 38.95 9.05)"
ROAD_B_LINE = "LINESTRING(38.70 8.95, 38.80 8.98, 38.90 9.00)"


def get_or_create_user(db, *, username: str, full_name: str, role: str, email: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is not None:
        return user
    user = User(
        username=username,
        full_name=full_name,
        email=email,
        role=role,
        is_active=True,
        password_hash=hash_password(DEMO_PASSWORD),
    )
    db.add(user)
    db.flush()
    print(f"  + user {username} ({role})")
    return user


def get_or_create_road(db, **kwargs) -> Road:
    road = db.scalar(select(Road).where(Road.road_code == kwargs["road_code"]))
    if road is not None:
        return road
    road = Road(**kwargs)
    db.add(road)
    db.flush()
    print(f"  + road {road.road_code} · {road.road_name}")
    return road


def get_or_create_section(db, **kwargs) -> RoadSection:
    section = db.scalar(
        select(RoadSection).where(RoadSection.section_code == kwargs["section_code"])
    )
    if section is not None:
        return section
    section = RoadSection(**kwargs)
    db.add(section)
    db.flush()
    print(f"  + section {section.section_code}")
    return section


def main() -> None:
    print("Seeding RAMS demo data…")
    with SessionLocal() as db:
        admin = get_or_create_user(
            db,
            username="admin",
            full_name="RAMS Administrator",
            role="admin",
            email="admin@rams.demo",
        )
        inspector = get_or_create_user(
            db,
            username="inspector",
            full_name="Field Inspector",
            role="inspector",
            email="inspector@rams.demo",
        )
        engineer = get_or_create_user(
            db,
            username="engineer",
            full_name="Road Engineer",
            role="engineer",
            email="engineer@rams.demo",
        )

        road_a = get_or_create_road(
            db,
            road_code="A001",
            road_name="Addis–Bishoftu Corridor",
            road_class="primary",
            surface_type="asphalt",
            start_location="Addis Ababa",
            end_location="Bishoftu",
            total_length_km=12.5,
            geometry=WKTElement(ROAD_A_LINE, srid=4326),
            status="active",
        )
        road_b = get_or_create_road(
            db,
            road_code="A002",
            road_name="Ring Road Segment West",
            road_class="secondary",
            surface_type="asphalt",
            start_location="CMC",
            end_location="Mexico Square",
            total_length_km=8.0,
            geometry=WKTElement(ROAD_B_LINE, srid=4326),
            status="active",
        )

        sec_a1 = get_or_create_section(
            db,
            road_id=road_a.road_id,
            section_code="A001-S1",
            start_chainage=0.0,
            end_chainage=5.0,
            length_km=5.0,
            surface_type="asphalt",
            condition_rating=72.0,
            geometry=WKTElement("LINESTRING(38.75 9.00, 38.85 9.02)", srid=4326),
        )
        sec_a2 = get_or_create_section(
            db,
            road_id=road_a.road_id,
            section_code="A001-S2",
            start_chainage=5.0,
            end_chainage=12.5,
            length_km=7.5,
            surface_type="asphalt",
            condition_rating=58.0,
            geometry=WKTElement("LINESTRING(38.85 9.02, 38.95 9.05)", srid=4326),
        )
        sec_b1 = get_or_create_section(
            db,
            road_id=road_b.road_id,
            section_code="A002-S1",
            start_chainage=0.0,
            end_chainage=8.0,
            length_km=8.0,
            surface_type="asphalt",
            condition_rating=81.0,
            geometry=WKTElement("LINESTRING(38.70 8.95, 38.90 9.00)", srid=4326),
        )

        # One inspection + defect if none exist for section A001-S2
        existing_insp = db.scalar(
            select(Inspection).where(Inspection.section_id == sec_a2.section_id).limit(1)
        )
        if existing_insp is None:
            insp = Inspection(
                section_id=sec_a2.section_id,
                inspector_id=inspector.user_id,
                inspection_date=date(2026, 9, 1),
                condition_rating=55.0,
                weather="clear",
                notes="Routine survey — surface distress observed.",
            )
            db.add(insp)
            db.flush()
            defect = RoadDefect(
                inspection_id=insp.inspection_id,
                section_id=sec_a2.section_id,
                defect_type="pothole",
                severity="high",
                chainage_km=7.2,
                length_m=1.5,
                width_m=0.8,
                depth_mm=60,
                description="Pothole near km 7.2 requiring patching.",
                geometry=WKTElement("POINT(38.90 9.04)", srid=4326),
                detected_by="manual",
            )
            db.add(defect)
            db.flush()
            maint = MaintenanceActivity(
                road_id=road_a.road_id,
                section_id=sec_a2.section_id,
                source_defect_id=defect.defect_id,
                activity_type="Pothole patching",
                priority="high",
                planned_date=date(2026, 9, 20),
                estimated_cost=45000,
                contractor="Demo Contractor PLC",
                status="planned",
                description="Cold-mix patch at chainage 7.2 km.",
            )
            db.add(maint)
            print("  + inspection, defect, and maintenance for A001-S2")

        db.commit()

    print("Done.")
    print(f"Demo logins (password: {DEMO_PASSWORD}):")
    print("  admin / inspector / engineer")


if __name__ == "__main__":
    main()
