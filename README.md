# HTU Viewer — Browsing History Explorer

A full-stack web application for viewing and analysing web browsing history exported from the **History Trends Unlimited** (HTU) Chrome extension.

## Features

- **Import** TSV files from HTU (3-col, 4-col, and 8-col formats)
- **Machine Tags** — tag each import with a machine name (e.g. "Work Laptop", "Home Desktop") and browse aggregate or per-machine history
- **Advanced Search** — filter by:
  - Keywords (full-text search across URL + title)
  - URL (contains match)
  - Domain (with subdomain support, or exact host with `=` prefix)
  - Page Title
  - Exact date, date range
  - Year, month, day of week, hour
  - Transition type (link, typed, form_submit, reload, etc.)
  - Machine
- **Dashboard** with aggregate stats:
  - Total visits, unique URLs, machines
  - Visits by hour, day of week, month, year
  - Visits by transition type
  - Top domains and URLs
- **Dark/Light theme** toggle
- **Simple password protection**

## Architecture

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | React 18 + Material UI 6 + Vite   |
| Backend  | Python 3.12 + FastAPI              |
| Database | PostgreSQL 16                      |
| Infra    | Docker Compose                     |

## Quick Start

### 1. Configure

Edit `docker-compose.yml` to set your password and secret key:

```yaml
environment:
  APP_PASSWORD: your-password-here
  SECRET_KEY: some-random-secret-string
```

### 2. Build & Run

```bash
docker compose up --build
```

### 3. Access

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/docs

### 4. Import Data

1. Log in with your configured password
2. Go to **Import** page
3. Enter a machine tag name (e.g. "Work Laptop")
4. Select your HTU `.tsv` export file
5. Click **Import**

## TSV Formats Supported

| Columns | Format | Fields |
|---------|--------|--------|
| 3 | Archived History (legacy) | url, visitTime, transition |
| 4 | Export History | url, visitTime, transition, title |
| 8 | Export These Results | url, host, root_domain, visitTime, datetime, weekday, transition, title |

Visit times prefixed with `U` are Unix epoch milliseconds. Without prefix, they are Windows epoch (microseconds since 1601-01-01).

## Development

### Backend only

```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+asyncpg://htu:htu_secret@localhost:5433/htu uvicorn app.main:app --reload
```

### Frontend only

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://htu:htu_secret@db:5432/htu` | Postgres connection string |
| `APP_PASSWORD` | `changeme` | Login password |
| `SECRET_KEY` | `change-this-...` | JWT signing key |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with password |
| GET | `/api/machines/` | List machines |
| POST | `/api/machines/` | Create machine |
| DELETE | `/api/machines/{id}` | Delete machine + all its data |
| POST | `/api/imports/upload` | Upload TSV file (multipart form) |
| GET | `/api/imports/` | List imports |
| DELETE | `/api/imports/{id}` | Delete import + its visits |
| POST | `/api/history/search` | Search history (JSON body with filters) |
| GET | `/api/history/stats` | Dashboard statistics |
| GET | `/api/health` | Health check |

## Useful Commands

```bash
# View logs
docker compose logs -f

# Rebuild after dependency changes
docker compose build

# Reset database
docker compose down -v && docker compose up -d

# Access database directly
docker compose exec db psql -U htu
```
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token expiry (24h) |
