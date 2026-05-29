# Fresh Setup Guide

End-to-end walkthrough for standing up the NRL Adaptive Learning System
from scratch — new Supabase project, new database, new local clone.
Follow top-to-bottom. Each section ends with a verification step so you
know it worked before moving on.

> **Prerequisites:** Python 3.11+, Node 20+, Git. On Windows, PowerShell
> works for every command shown. WSL or Linux/macOS also fine.

---

## 1. Clone the repo

```bash
git clone https://github.com/YOUR-FORK/NRL-Adaptive-Learning-System.git
cd NRL-Adaptive-Learning-System
```

If you're forking, do that first on GitHub, then clone your fork.

---

## 2. Create a Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Pick a strong DB password (you won't need it for app auth — only if
   you ever connect via psql).
3. Region: pick the one closest to your backend host (Singapore if
   you're using the `sin` Fly.io region default).
4. Once provisioning finishes, copy these three values from
   **Project Settings → API**:
   - **JWT Secret** (under "JWT Settings" — *click reveal*)
   - **Project URL**
   - **anon public** key

> The JWT Secret is **server-side only** — never put it in frontend env
> files or commit it. The anon key is meant to be public.

---

## 3. Create a Postgres database

The recommended path is Neon, which gives you a free serverless
Postgres with branch-style isolation.

1. Sign in at <https://neon.tech> → **New project**.
2. Pick the same region as your Supabase project.
3. From **Connection Details**, copy the **asyncpg** connection string.
   It looks like:

   ```
   postgresql+asyncpg://USER:PASSWORD@ep-XXX.eu-west-2.aws.neon.tech/neondb
   ```

   If the dashboard only shows `postgresql://`, prepend `+asyncpg` to
   the scheme yourself.

You can also use a self-hosted Postgres — the app only needs an async
driver-compatible URL.

---

## 4. Configure environment variables

### Backend (`.env` at the repo root)

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Key                       | Source                                    |
| ------------------------- | ----------------------------------------- |
| `DATABASE_URL`            | step 3                                    |
| `SUPABASE_JWT_SECRET`     | step 2 — **JWT Secret**                   |
| `SUPABASE_URL`            | step 2 — **Project URL**                  |
| `CORS_ORIGINS`            | leave default for local dev               |
| `ENVIRONMENT`             | `development` locally, `production` on deploy |
| `AUTO_CREATE_TABLES`      | `true` only on the very first dev bootstrap (see step 6) |

### Frontend (`frontend/.env.local`)

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local` and fill in:

| Key                              | Source                  |
| -------------------------------- | ----------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | step 2 — Project URL    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | step 2 — anon key       |
| `NEXT_PUBLIC_API_URL`            | leave default for local dev |

**Verification:** `cat .env | grep -v '^#'` should show no `REPLACE_WITH_` placeholders.

---

## 5. Install dependencies

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

> PyTorch is optional. On Windows + Python 3.13 the install is skipped
> automatically. The adaptive engine still works in heuristic mode.

### Frontend

```bash
cd ../frontend
npm install
```

**Verification:**
```bash
# backend
python -c "import fastapi, alembic, sqlalchemy; print('ok')"
# frontend
npx tsc --noEmit
```

---

## 6. Bootstrap the database

You have two paths. **Pick exactly one.**

### Path A — Local development (fast)

Let SQLAlchemy create the schema directly, then mark Alembic so future
migrations apply cleanly.

```bash
cd backend
# 1. Create all tables.
AUTO_CREATE_TABLES=true python -c "import asyncio; from app.core.database import init_db; asyncio.run(init_db())"
# 2. Tell Alembic the schema is fully up-to-date.
alembic stamp head
# 3. Seed cybersecurity topics, starter questions, and learning modules.
python seed.py
```

### Path B — Production / shared environments (strict)

Migrations are the source of truth. Never run `create_all()` in prod.

```bash
cd backend
# 1. Apply every migration in order.
alembic upgrade head
# 2. Seed reference data.
python seed.py
```

Either path leaves you with the same final state.

**Verification:**
```bash
cd backend
alembic current
# Expected output ends with: 0002_add_session_consecutive_correct (head)
```

---

## 7. Run the app locally

Open two terminals.

**Terminal 1 — backend:**
```bash
cd backend
.venv\Scripts\activate   # or: source .venv/bin/activate
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or use the helper:
```bash
scripts\start_backend.bat        # Windows
scripts/run-dev.sh               # macOS/Linux (runs both)
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

Open:
- Frontend: <http://localhost:3000>
- API docs (Swagger): <http://localhost:8000/docs>

**Verification:**
1. Sign up at `/register` — should redirect to `/dashboard`.
2. Start a session at `/session` — pick **Web Security** and answer one
   question.
3. The streak indicator should increment on a correct answer.

---

## 8. Run the test suite

```bash
# backend
cd backend
pytest -q

# frontend
cd ../frontend
npm run typecheck
npm run lint -- --max-warnings=0
```

Expected: backend `84 passed, 3 skipped`; frontend lint and typecheck
both silent (exit code 0).

---

## 9. (Optional) Train the DQN

Heuristic mode is production-grade by itself. Train the DQN if you want
the neural policy to take over:

```bash
cd backend
python -m app.ml.train_dqn --episodes 50    # quick smoke run
python -m app.ml.train_dqn                  # full 800-episode run
# Weights saved to backend/app/ml/models/dqn_agent.pt
```

The engine auto-loads `dqn_agent.pt` at startup.

---

## 10. Deploy

### Backend (Fly.io)

```bash
cd backend
flyctl launch --no-deploy                     # one-time setup
flyctl secrets set \
  DATABASE_URL='postgresql+asyncpg://...' \
  SUPABASE_JWT_SECRET='your-jwt-secret' \
  SUPABASE_URL='https://your-project.supabase.co'
# Apply migrations BEFORE flipping traffic:
alembic upgrade head
flyctl deploy
```

### Frontend (Vercel)

1. Import the GitHub repo on Vercel, set root directory to `frontend/`.
2. Project Settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (your Fly.io URL)
3. Trigger a deploy.

### Update CORS

Add your Vercel URL to `CORS_ORIGINS` via `flyctl secrets set` and
redeploy the backend.

---

## 11. Health-check checklist

| Check                                                    | Pass criteria                  |
| -------------------------------------------------------- | ------------------------------ |
| `GET /health` on backend                                 | `{"status":"healthy",...}`     |
| Frontend `/` loads                                       | landing page renders           |
| Sign up + log in                                         | redirect to `/dashboard`       |
| Start `/session?topic=web-security` and answer 1 question | `is_correct` returns true/false correctly, streak increments |
| `/analytics` Focus link                                  | routes to `/session?topic=web-security`, not `/session?topic=Web%20Security` |
| `/dashboard` weak-topic CTA                              | uses slug in URL, not display title |
| Logout from sidebar                                      | lands on `/login`              |
| `/learning` → start a lab → submit wrong → submit right  | wrong returns `is_correct: false`, right returns `is_correct: true` |
| `pytest -q` in backend                                   | green                          |
| `npm run typecheck && npm run lint` in frontend          | green                          |
| `alembic current` in backend                             | shows latest revision          |

---

## 12. Common gotchas

- **`SUPABASE_JWT_SECRET is required but was not set`** — `.env` was
  not loaded. Check the file is at the repo root, not inside `backend/`.
- **`The asyncio extension requires an async driver`** when running
  alembic — `DATABASE_URL` is `postgresql+asyncpg://...` (good for the
  app) but alembic needs sync. The `env.py` strips `+asyncpg`
  automatically, so this normally just works; the error means your
  `.env` didn't load. Run `alembic upgrade head` from inside `backend/`
  with `.env` at the repo root.
- **`Topic 'foo' has no quiz content available`** — content-backed
  topic validation kicked in. Either seed questions for that topic or
  pick `web-security` (only topic with JSON content out of the box).
- **`Session expired`** toast right after sign-in** — the cached
  Supabase session in `localStorage` is stale. Visit `/clear-session`
  (local only) and sign in again.
- **`Module not found: 'torch'`** when running training — install torch
  via `pip install torch` in your backend venv.
