# RAMS Backend

FastAPI backend for the Road Asset Management System.

## Stack

- FastAPI
- SQLAlchemy
- PostgreSQL/PostGIS
- GeoAlchemy2
- Alembic

## Run locally

1. Create a Python virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Apply database migrations:

```bash
export DATABASE_URL=postgresql+psycopg://rams_user:change_me@localhost:5432/rams
alembic upgrade head
```

5. Start the API:

```bash
uvicorn app.main:app --reload
```

Health endpoint:

```text
GET /health
```

API documentation is available at `/docs` when the server is running.

## Database migrations (Alembic)

Migrations live under `alembic/versions/`.

```bash
# Apply all migrations
alembic upgrade head

# Create a new revision after schema changes
alembic revision -m "describe change"
# edit the generated file, then:
alembic upgrade head

# Show current revision
alembic current
```

Fresh databases can also be initialized with `database/schema.sql`.
Alembic tracks subsequent changes; Docker Compose runs `alembic upgrade head` on backend startup.
