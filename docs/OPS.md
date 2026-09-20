# RAMS operations runbook

Short guide for keeping production healthy.

## Services

| Piece | Typical URL / location |
|-------|-------------------------|
| Backend API | `https://rams-backend-3zlb.onrender.com` |
| API docs | `/docs` |
| Frontend | your static host / Vite deploy |
| Database | Managed Postgres + **PostGIS** |
| GitHub repo | `chandem/road-asset-management-system` branch `main` |

## Required secrets (Render + GitHub Actions)

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` / `RAMS_DATABASE_URL` | `postgresql+psycopg://…` (or `postgresql://` with psycopg) |
| `JWT_SECRET_KEY` / `RAMS_JWT_SECRET_KEY` | ≥ 32 characters |
| `RAMS_ADMIN_USERNAME` / `PASSWORD` | Admin bootstrap workflow |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `TRUSTED_HOSTS` | Include your Render hostname |

### Optional photo storage (recommended)

| Variable | Example |
|----------|---------|
| `STORAGE_BACKEND` | `s3` (default `local`) |
| `S3_BUCKET` | your bucket name |
| `S3_ENDPOINT_URL` | R2/MinIO endpoint |
| `S3_ACCESS_KEY_ID` | key |
| `S3_SECRET_ACCESS_KEY` | secret |
| `S3_PUBLIC_BASE_URL` | public CDN base (optional) |
| `S3_PREFIX` | `rams/images` |

Without S3, photos are stored on the instance disk and **may be lost** on free-tier restarts.

Check: `GET /api/v1/storage/status` (authenticated).

### AI detection

| Variable | Meaning |
|----------|---------|
| `AI_STUB_MODE=true` | No weights; empty detections (safe for demos/CI) |
| `AI_MODEL_PATH` | Path to YOLO `.pt` road-defect weights |
| `AI_CONFIDENCE_THRESHOLD` | Default `0.25` |

**Production note:** ship real weights or leave stub mode on and treat AI as optional. Status: `GET /api/v1/ai/status`.

## Deploy checklist

1. Push to `main`.
2. **Render → Auto-Deploy = Yes** (or Manual Deploy latest commit).
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
   (Run migrations via GitHub Action **RAMS database migration**, not on free-plan start if shell is unavailable.)
4. Confirm `/docs` and login.
5. Frontend: set `VITE_API_BASE_URL` / `VITE_API_BASE_URL_RAMS` to `https://…/api/v1`.

## GitHub Actions (manual)

| Workflow | Use |
|----------|-----|
| **RAMS CI** | Tests on push |
| **Database migration** | `alembic upgrade head` against prod DB |
| **Admin password setup** | Create/update admin user |
| **Seed demo data** | A001–A003 roads near Addis |
| **API Smoke** | Health + optional login/roads |

## Field offline behaviour

- Queues live in **IndexedDB** on the device.
- Sync retries automatically when online.
- After repeated permanent failures (duplicate / validation), records are marked **`conflict`** with `last_error` and stop retrying until the user removes or fixes them.
- Idempotent `client_id` on inspections/defects avoids double-create when the same offline row syncs twice.

## Road geometry & sections

- **Operations → Roads → Draw geometry on map** fills WKT + estimated length.
- **Generate sections** uses `total_length_km` or PostGIS length; `length_km` on sections is a **generated** DB column — never insert it.

## Incident tips

| Symptom | Check |
|---------|--------|
| 500 on login | Migrations applied? PostGIS enabled? |
| Generate sections / `length_km` GeneratedAlways | Redeploy backend with latest `main` |
| Port scan timeout | Bind `0.0.0.0:$PORT` |
| Photos vanish | Enable `STORAGE_BACKEND=s3` |
| AI empty | Expected if `AI_STUB_MODE=true` or missing weights |
