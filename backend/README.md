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
4. Start the API:

```bash
uvicorn app.main:app --reload
```

Health endpoint:

```text
GET /health
```

API documentation is available at `/docs` when the server is running.
