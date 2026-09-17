# Road Asset Management System (RAMS)

[![RAMS CI](https://github.com/chandem/road-asset-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/chandem/road-asset-management-system/actions/workflows/ci.yml)

A road asset management platform for collecting, organizing, assessing, and managing road infrastructure data.

## Purpose

RAMS is designed to support road agencies, maintenance teams, and engineers with a centralized system for road inventory, condition assessment, maintenance planning, GIS/GPS data, reporting, and future AI-assisted road defect detection.

## Planned Features

- Road and road-section inventory
- Chainage-based asset referencing
- GPS/GIS location and mapping
- Road condition and defect assessment
- Bridges, culverts, drainage, signs, and other asset records
- Maintenance planning and prioritization
- Work history and maintenance records
- Dashboards and reports
- Image-based road defect classification
- Role-based access and user management
- Centralized database and API

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Leaflet |
| Backend | FastAPI + SQLAlchemy |
| Database | PostgreSQL + PostGIS |
| Migrations | Alembic |
| Auth | JWT + bcrypt |
| AI (planned) | Ultralytics YOLO |

## Getting Started

### Option A — Docker (recommended)

**Requirements:** Docker and Docker Compose

```bash
# Clone the repository
git clone https://github.com/chandem/road-asset-management-system.git
cd road-asset-management-system

# Start the full stack (PostGIS + backend + frontend)
docker compose up --build
```

Once running (via the nginx proxy):

| Service | URL |
|---------|-----|
| App (frontend) | http://localhost |
| Backend API docs | http://localhost/api/v1/docs (or direct backend if exposed) |
| Health | http://localhost/health |

Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` and `JWT_SECRET_KEY` before the first `docker compose up`.

On first start the DB loads `database/schema.sql`. The backend then runs `alembic upgrade head` so future schema changes are versioned.

Local Vite-only frontend (manual Option B) still uses `http://localhost:5173` with the API on `http://localhost:8000`.

To stop:

```bash
docker compose down
```

To reset the database (delete all data):

```bash
docker compose down -v
```

### Option B — Manual (local development)

#### 1. Database

Install PostgreSQL with PostGIS, then create the database and user:

```sql
CREATE USER rams_user WITH PASSWORD 'change_me';
CREATE DATABASE rams OWNER rams_user;
```

Apply the schema with Alembic (preferred):

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://rams_user:change_me@localhost:5432/rams
pip install -r requirements.txt
alembic upgrade head
```

Or load the SQL baseline once:

```bash
psql -U rams_user -d rams -f database/schema.sql
```

#### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET_KEY (min 32 characters)

uvicorn app.main:app --reload
```

API will be available at http://localhost:8000

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:5173

### Create an admin user

With the backend running and database configured:

```bash
cd backend
export PYTHONPATH=.
export DATABASE_URL=postgresql+psycopg://rams_user:change_me@localhost:5432/rams
export JWT_SECRET_KEY=your-secret-at-least-32-characters-long

python scripts/create_admin.py --username admin --full-name "Admin User" --email admin@example.com
```

You will be prompted for a password (minimum 8 characters).

With Docker:

```bash
docker compose exec backend python scripts/create_admin.py --username admin --full-name "Admin User"
```

### Seed demo data

Load sample users, roads, sections, an inspection, defect, and maintenance activity:

```bash
cd backend
export PYTHONPATH=.
export DATABASE_URL=postgresql+psycopg://rams_user:change_me@localhost:5432/rams
export JWT_SECRET_KEY=your-secret-at-least-32-characters-long

python scripts/seed_demo_data.py
```

Docker:

```bash
docker compose exec backend python scripts/seed_demo_data.py
```

Demo accounts (password **`DemoPass123!`**):

| Username | Role |
|----------|------|
| admin | admin |
| engineer | engineer |
| inspector | inspector |

The script is idempotent — safe to run more than once.

### Environment variables

See `.env.example` (root) and `backend/.env.example` for the full list.

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Secret for signing tokens (min 32 chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 60) |
| `VITE_API_BASE_URL` | Frontend → backend API base URL |

## Project Structure

```text
.
├── backend/          # FastAPI application
│   ├── alembic/      # Alembic migrations
│   ├── app/
│   │   ├── api/      # Routes
│   │   ├── core/     # Config, security
│   │   ├── db/       # Session
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   └── services/ # Business logic (e.g. AI detection)
│   ├── scripts/      # create_admin.py, seed_demo_data.py
│   └── tests/
├── frontend/         # React + Vite UI
├── database/         # schema.sql + legacy SQL migrations
├── ai/               # YOLO training scripts
└── docker-compose.yml
```

## Development Roadmap

1. Project foundation and repository structure
2. Database design
3. Backend API
4. React frontend
5. Road and asset inventory
6. GIS/GPS integration
7. Condition assessment and maintenance planning
8. Reporting and dashboards
9. Image-based defect detection
10. Testing, deployment, and security improvements

## Project Status

🚧 **Active development**

RAMS is under development and the architecture will evolve as new road-management requirements are added.

## Vision

The long-term goal is to provide a practical digital platform that helps road engineers and maintenance organizations make better use of road-asset data, improve maintenance planning, and support data-driven infrastructure management.

## License

License information will be added as the project matures.
