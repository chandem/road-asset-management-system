# RAMS production deployment

This guide covers running the Docker Compose stack in a real environment (agency server or VPS). For local demos, see the root [README](../README.md).

## 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A public hostname (e.g. `rams.example.com`) pointing at the server
- TLS certificates (Let’s Encrypt or agency PKI)
- At least 2 CPU / 4 GB RAM recommended (PostGIS + API + optional YOLO)

## 2. Secrets and environment

Never commit real secrets. On the server:

```bash
cp .env.example .env
chmod 600 .env
```

Set at least:

| Variable | Production guidance |
|----------|---------------------|
| `POSTGRES_PASSWORD` | Long random password (unique to this deploy) |
| `JWT_SECRET_KEY` | ≥ 32 random characters; rotate if leaked |
| `DEBUG` | `false` |
| `CORS_ALLOWED_ORIGINS` | Exact public origin, e.g. `https://rams.example.com` |
| `TRUSTED_HOSTS` | Hostname only, e.g. `rams.example.com` |
| `AI_STUB_MODE` | `false` when a real model is available; `true` only for demos |
| `AI_MODEL_PATH` | Path inside the backend container (default `models/road_defect.pt`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | e.g. `60` (shorter is safer for shared field devices) |

Generate secrets:

```bash
openssl rand -base64 32   # JWT_SECRET_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
```

Update `deploy/nginx.conf` `server_name` to your hostname.

## 3. TLS certificates

Compose mounts `./deploy/tls` into the proxy:

```text
deploy/tls/fullchain.pem
deploy/tls/privkey.pem
```

**Let’s Encrypt (example with certbot on the host):**

```bash
sudo certbot certonly --standalone -d rams.example.com
sudo mkdir -p deploy/tls
sudo cp /etc/letsencrypt/live/rams.example.com/fullchain.pem deploy/tls/
sudo cp /etc/letsencrypt/live/rams.example.com/privkey.pem deploy/tls/
sudo chmod 640 deploy/tls/privkey.pem
```

Renewal: copy new files into `deploy/tls` and reload nginx:

```bash
docker compose exec proxy nginx -s reload
```

Until certificates exist, HTTP-only local testing can use a temporary nginx config that listens on port 80 only (do not use that pattern on the public internet).

## 4. Start the stack

```bash
cd /opt/rams   # or your clone path
docker compose up --build -d
```

Check health:

```bash
curl -fsS https://rams.example.com/health
# expect: {"status":"ok","service":"rams-api"}
```

Open the app at `https://rams.example.com` and API docs at `https://rams.example.com/api/v1/docs` (consider restricting `/docs` in hardened deploys).

### First admin user

```bash
docker compose exec backend python scripts/create_admin.py \
  --username admin --full-name "System Admin" --email admin@example.com
```

Optional demo data (non-production only):

```bash
docker compose exec backend python scripts/seed_demo_data.py
```

## 5. AI model in production

1. Place weights on the host under `./models/road_defect.pt` (Compose mounts `./models` read-only).
2. In `.env`:

```bash
AI_STUB_MODE=false
AI_MODEL_PATH=models/road_defect.pt
AI_CONFIDENCE_THRESHOLD=0.25
```

3. Restart backend:

```bash
docker compose up -d backend
```

4. Confirm readiness: Field tab → AI status banner, or `GET /api/v1/ai/status` with a token.

If weights or Ultralytics are missing, the API returns **503** with a clear message instead of crashing.

## 6. Database backups

Postgres data lives in the `rams_pgdata` volume.

**Logical backup (recommended):**

```bash
# dump
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backup-$(date +%F).dump

# restore (destructive — empty DB first or use a new volume)
cat backup-YYYY-MM-DD.dump | docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
```

Schedule daily dumps with cron and copy off-server. Keep at least 7 daily + 4 weekly copies.

**Uploads:** photos live in the `backend_uploads` volume — include that path in backup policy if field photos are authoritative records.

## 7. Updates and migrations

```bash
git pull
docker compose build
docker compose up -d
```

On backend start, `alembic upgrade head` runs automatically. For risky schema changes, take a dump first.

## 8. Hardening checklist

- [ ] `DEBUG=false`
- [ ] Strong unique `POSTGRES_PASSWORD` and `JWT_SECRET_KEY`
- [ ] `CORS_ALLOWED_ORIGINS` and `TRUSTED_HOSTS` match the public hostname only
- [ ] TLS valid; HSTS enabled via nginx
- [ ] Firewall: only 80/443 (and SSH) exposed; DB port not published
- [ ] `AI_STUB_MODE=false` if real inference is required
- [ ] Admin password not left as demo defaults
- [ ] Backups tested with a restore drill
- [ ] Log rotation for Docker (`json-file` max-size) or external logging

## 9. Troubleshooting

| Symptom | Check |
|---------|--------|
| 502 from proxy | `docker compose ps`, backend logs, `curl http://backend:8000/health` from proxy network |
| TrustedHost / 400 | `TRUSTED_HOSTS` must include the browser Host header |
| CORS errors | `CORS_ALLOWED_ORIGINS` must be exact origin (`https://…`, no trailing slash mismatch) |
| Login fails after restart | JWT secret changed → users must sign in again |
| AI always stub | `AI_STUB_MODE`, file at `AI_MODEL_PATH`, backend logs for Ultralytics import |
| Migrations fail | DB volume from older schema — restore dump or run `alembic` manually |

## 10. Rollback

```bash
git checkout <previous-tag-or-commit>
docker compose up --build -d
# restore DB dump if schema is incompatible
```

Tag releases so rollbacks are reproducible.
