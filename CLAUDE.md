# Hotel Maintenance System — CLAUDE.md

## Project Overview

A hotel maintenance request system. Staff report issues, technicians receive and complete jobs, supervisors/admins oversee everything. Bilingual (Thai/English).

**Live URL:** https://hotel-maintenance-production-e091.up.railway.app  
**Deploy:** `railway up --detach` (run from this directory)  
**Infra:** Railway — project `calm-celebration`, service `hotel-maintenance` + Postgres

---

## Architecture

```
hotel-maintenance/
├── backend/              # FastAPI (Python)
│   ├── main.py           # App entry: lifespan, migrations, seed, static serving
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic schemas (in/out)
│   ├── auth.py           # JWT, password hashing, role guards
│   ├── database.py       # SQLAlchemy engine + session
│   ├── config.py         # Settings via pydantic-settings
│   ├── routers/          # One file per resource
│   │   ├── auth.py       # /api/auth — login, /me, change-password
│   │   ├── jobs.py       # /api/jobs — all job lifecycle endpoints
│   │   ├── users.py      # /api/users
│   │   ├── areas.py      # /api/areas + /api/areas/sub
│   │   ├── issue_types.py
│   │   ├── departments.py
│   │   ├── onduty.py
│   │   └── reports.py    # /api/reports/summary|list|technicians|by-area|...
│   ├── services/
│   │   ├── storage.py    # Cloudinary image upload
│   │   └── notification.py  # Telegram bot notifications
│   └── bot/              # python-telegram-bot polling
├── src/                  # React + Vite + Tailwind frontend
│   ├── pages/
│   │   ├── DashboardPage.jsx
│   │   ├── RequestsPage.jsx
│   │   ├── RequestDetailPage.jsx
│   │   ├── NewRequestPage.jsx
│   │   ├── ReportsPage.jsx
│   │   ├── OnDutyPage.jsx
│   │   └── AdminPage.jsx
│   ├── components/
│   │   ├── layout/Layout.jsx   # Sidebar nav + change-password modal
│   │   └── common/
│   │       ├── JobDrawer.jsx   # Slide-in job detail panel
│   │       └── StatusBadge.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── LangContext.jsx     # i18n — t('key.path')
│   ├── lib/api.js              # All fetch calls to /api/*
│   └── locales/
│       ├── en.js
│       └── th.js
├── frontend/             # Vite build output (served by FastAPI)
├── run.py                # Starts uvicorn
└── vite.config.js        # Proxy: /api/* and /uploads/* → localhost:8000
```

**How it runs:** FastAPI serves the built React app from `frontend/` as static files and mounts all `/api/*` routes. In dev, Vite proxies `/api` to port 8000.

---

## Dev Setup

```bash
# Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run.py          # starts on :8000

# Frontend (separate terminal)
npm install
npm run dev            # starts on :5173, proxies /api to :8000
```

Default admin credentials (seeded on first run): `admin` / `admin1234`

---

## Database & Migrations

- **Production:** PostgreSQL on Railway (`DATABASE_URL` env var)
- **Local dev:** SQLite (`hotel_maintenance.db`)
- **No Alembic.** Migrations are inline in `backend/main.py` → `run_migrations()`.
  - Pattern: `ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {type}` (Postgres) or without `IF NOT EXISTS` (SQLite, wrapped in try/except)
  - Add new columns to the `migrations` list in `run_migrations()`, AND add the column to the SQLAlchemy model.
- `Base.metadata.create_all()` runs on startup (creates new tables), then `run_migrations()` adds new columns to existing tables.

---

## User Roles

| Role | Access |
|------|--------|
| `admin` | Everything including system settings |
| `supervisor` | Dashboard, requests, reports, on-duty |
| `technician` | Dashboard, requests, on-duty |
| `staff` | Dashboard, new request, requests list |

---

## Job Lifecycle

**Request statuses:** `pending → assigned → in_progress → pending_inspection → completed`  
Also: `external_tech`, `reopened`, `cancelled`

**Work order statuses:** `assigned → in_progress → completed`  
Also: `external`, `rejected`, `transferred`

**Request number format:** `MR{YYYYMMDD}{seq:03d}` (e.g. `MR202406150001`)

---

## Critical: FastAPI Route Ordering in `jobs.py`

Fixed-path routes MUST come before `/{job_id}`. Current order — do not break it:

```python
GET  ""                    # list jobs
GET  "/location-history"   # ← must be before /{job_id}
GET  "/completed-today"    # ← must be before /{job_id}
GET  "/{job_id}"           # get single job
```

Same rule applies in `areas.py` (`/reorder` before `/{area_id}`, `/sub/reorder` before `/sub/{sub_id}`) and `issue_types.py` (`/reorder` before `/{type_id}`).

**Any new fixed-path GET/PUT route must be registered BEFORE the `/{id}` wildcard route.**

---

## i18n

- Hook: `const { t, lang, setLang } = useLang()`
- Keys: dot-notation strings, e.g. `t('dashboard.stats.pending')`
- Locale files: `src/locales/en.js` and `src/locales/th.js` — keep both in sync
- Date locale: `lang === 'th' ? thLocale : enUS` (from `date-fns/locale`)
- OOO dates: always use `format(parseISO(dateStr), 'd MMM yy', { locale: dateLocale })`

---

## OOO (Out of Order) Rooms

A job has an active OOO when any of its work orders satisfies:
```js
w.ooo_room === true
&& ['assigned', 'in_progress', 'external'].includes(w.status)
&& (!w.ooo_end_date || w.ooo_end_date >= today)  // today = 'YYYY-MM-DD'
```
This logic lives in `jobHasActiveOoo()` in `DashboardPage.jsx` and is mirrored in the backend reports query (`reports.py`).

---

## Key Patterns

**API calls:** All in `src/lib/api.js`. Use `api.methodName(args)` — never fetch directly in components.

**Soft deletes:** Areas, sub-areas, issue types, and users are soft-deleted (`is_active = False`). The list endpoints filter by `is_active == True`.

**Sort order:** `main_areas`, `sub_areas`, `issue_types` have a `sort_order` column. List endpoints order by `(sort_order, name)`. Reorder via `PUT /api/areas/reorder`, `/api/areas/sub/reorder`, `/api/issue-types/reorder` with `{ ids: [...] }`.

**Auth guard:** `require_roles("admin")` — imported from `backend/auth.py`, used as a FastAPI dependency. Returns the current user or raises 403.

**Images:** Cloudinary for production, `uploads/` folder for local. `imgUrl(filename)` in `api.js` handles both (Cloudinary URLs start with `https://`).

**Notifications:** Telegram bot in `backend/bot/`. Sends to multiple group IDs from env vars (`TELEGRAM_GROUP_ALL`, `_REPORTER`, `_TECHNICIAN`, `_INSPECTOR`).

---

## Environment Variables (Railway)

```
DATABASE_URL              # PostgreSQL — set automatically via Railway Postgres
SECRET_KEY                # JWT signing key
TELEGRAM_BOT_TOKEN
TELEGRAM_GROUP_ALL
TELEGRAM_GROUP_REPORTER
TELEGRAM_GROUP_TECHNICIAN
TELEGRAM_GROUP_INSPECTOR
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

---

## Done Today Logic

`GET /api/jobs/completed-today` returns jobs where:
- A work order's `completed_at >= today` (tech submitted repair today), **or**
- An inspection with `result='pass'` was created today

---

## Reorder Endpoints

All accept `{ ids: [id, id, ...] }` and assign `sort_order = 0, 1, 2, ...` in that sequence.

| Endpoint | Router file |
|----------|-------------|
| `PUT /api/areas/reorder` | `routers/areas.py` |
| `PUT /api/areas/sub/reorder` | `routers/areas.py` |
| `PUT /api/issue-types/reorder` | `routers/issue_types.py` |
