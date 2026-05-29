# NRL Adaptive Learning System

Adaptive cybersecurity learning platform. Content difficulty adjusts in real-time using a hybrid engine: deterministic safety rules → Neural DQN policy → heuristic fallback. Authentication is fully managed by Supabase.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| UI | Recharts, Framer Motion, Lucide React, TanStack Query |
| Backend | FastAPI 0.115, Python 3.11+, SQLAlchemy 2.0 async |
| Database | PostgreSQL (Neon cloud) via asyncpg |
| Auth | Supabase Auth — JWT validated server-side with PyJWT |
| Adaptive Engine | Safety rules → DQN (PyTorch, optional) → heuristic fallback |
| Content | Static JSON datasets — no AI generation dependency |

## Prerequisites

- Python 3.11+
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A PostgreSQL database — [Neon](https://neon.tech) free tier recommended

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/Shashank-U-04/NRL-Adaptive-Learning-System.git
cd NRL-Adaptive-Learning-System
cp .env.example .env
```

Edit `.env` and fill in the required values (see [Environment Variables](#environment-variables)).

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. From **Project Settings → API**, copy:
   - `JWT Secret` → `SUPABASE_JWT_SECRET` in `.env`
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` in `frontend/.env.local`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`

### 3. Database setup

The backend supports two paths, chosen via `AUTO_CREATE_TABLES`:

- **Development / local** — `AUTO_CREATE_TABLES` is unset (or `true`) and
  `ENVIRONMENT` is anything other than `production`. The app runs
  SQLAlchemy `create_all()` on startup. No migration step needed.
- **Production** — `AUTO_CREATE_TABLES=false` (the default for
  `ENVIRONMENT=production`). The app skips `create_all()` because it
  can't safely apply schema changes. Run Alembic migrations before
  each deploy that touches the schema.

#### Apply migrations (production)

From the `backend/` directory, with `DATABASE_URL` set:

```bash
pip install -r requirements.txt
alembic upgrade head
```

Or run the plain-SQL equivalent if you can't install Alembic in the
deploy environment:

```bash
psql "$DATABASE_URL" -f backend/migrations/sql/001_add_source_question_id.sql
psql "$DATABASE_URL" -f backend/migrations/sql/002_add_session_consecutive_correct.sql
```

See `backend/migrations/README.md` for first-time-setup details
(stamping an existing DB, authoring new revisions).

#### Legacy password-column cleanup

If you are migrating from an older schema (pre-2.x with password-hash
auth columns), run these statements once against your PostgreSQL
database (Supabase SQL editor or psql):

```sql
-- Drop legacy password columns left over from custom auth.
ALTER TABLE IF EXISTS users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS password_hash;
```

> **Do not** `TRUNCATE` real user tables — this is destructive.
> If you need a clean slate in dev, drop and recreate the database
> instead, or use a separate dev Neon branch.

### 4. Backend

```bash
cd backend
pip install -r requirements.txt
python seed.py          # populates learning_modules table
uvicorn app.main:app --reload --port 8000
```

Swagger docs: **http://localhost:8000/docs**

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: **http://localhost:3000**

## Environment Variables

### Backend — `.env`

```env
# Required
DATABASE_URL=postgresql+asyncpg://user:password@host/db
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Optional
SUPABASE_URL=https://your-project.supabase.co
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
RL_EXPLORATION_RATE=0.05
SESSION_TTL_SECONDS=3600
LOG_LEVEL=INFO
ENVIRONMENT=development
```

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Features

- **Adaptive difficulty** — 3-phase engine: safety rules → DQN neural policy → heuristic fallback
- **Supabase Auth** — sign up, sign in, sign out; no custom token management
- **XP, streaks, knowledge level** — tracked per user session
- **Global leaderboard** — ranked by XP
- **Interactive lab simulations** — pattern matching, safe (no code execution)
- **Analytics dashboards** — accuracy trend, weak topics, session history
- **Static content delivery** — cybersecurity modules from JSON; zero AI API cost
- **Security headers** — X-Content-Type-Options, X-Frame-Options, HSTS (production), CORS locked down

## Project Structure

```
NRL-Adaptive-Learning-System/
├── backend/
│   ├── app/
│   │   ├── adaptive/          # Adaptive engine (rules.py, engine.py, future_dqn.py)
│   │   ├── api/routes/        # auth, sessions, analytics, leaderboard, learning
│   │   ├── core/              # config, database, dependencies (JWT validation), logging
│   │   ├── data/              # Static cybersecurity JSON content
│   │   ├── ml/                # DQN model architecture + training pipeline
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   └── services/          # auth_service, module_service, session_service
│   ├── tests/
│   ├── requirements.txt
│   ├── seed.py                # Populates learning_modules from static JSON
│   └── app/ml/train_dqn.py    # Offline DQN training script (python -m app.ml.train_dqn)
├── frontend/
│   └── src/
│       ├── app/               # Next.js pages: dashboard, session, analytics, leaderboard, ...
│       ├── components/        # AppLayout, Sidebar, Charts, UI primitives
│       ├── features/learning/ # Learning renderer, quiz engine, lab panel
│       └── lib/               # supabase.ts, auth-context.tsx, api.ts
├── .github/workflows/         # CI (test + lint) and deploy pipelines
├── docker-compose.yml         # Local dev: backend + frontend + postgres
└── monitoring/                # Grafana/Loki configs (optional observability)
```

## Docker (local dev)

```bash
# Requires SUPABASE_JWT_SECRET in your shell environment
SUPABASE_JWT_SECRET=your-secret docker-compose up --build
```

Services: **backend** on :8000, **frontend** on :3000, **postgres** on :5432.

## Training the DQN (optional)

> **Current status:** no `dqn_agent.pt` weights ship with the repo, so
> the adaptive engine runs in **heuristic mode** out of the box. The
> safety rules + heuristic fallback in `app/adaptive/rules.py` are
> production-grade on their own; the DQN is an upgrade path, not a
> prerequisite. Train and drop weights at
> `backend/app/ml/models/dqn_agent.pt` to activate the neural policy.

The adaptive engine works without a trained model (falls back to the
deterministic heuristic). To produce real weights, run the training
pipeline from the `backend/` directory with a venv that has PyTorch
installed:

```bash
cd backend
python -m app.ml.train_dqn --episodes 50    # quick smoke run
python -m app.ml.train_dqn                  # full 800-episode run
# Weights are saved to backend/app/ml/models/dqn_agent.pt
```

The engine auto-loads `dqn_agent.pt` at startup if the file exists.

The state schema used for training is the same 7-feature vector encoded
by `app.ml.dqn_model.encode_state`:

```
quiz_accuracy, mcq_accuracy, lab_success_rate, recent_trend,
attempts_count, avg_response_time, topic_confidence
```

Training environment: `app.ml.student_env_v2.AdaptiveStudentEnv`.

## API Reference

Full interactive API docs at **http://localhost:8000/docs** when running locally.

| Prefix | Routes |
|--------|--------|
| `GET /health` | Health check |
| `/api/v1/auth` | GET /me, PUT /profile |
| `/api/v1/sessions` | Start, answer, end, history |
| `/api/v1/analytics` | Dashboard stats, accuracy trend |
| `/api/v1/leaderboard` | Global + topic leaderboard |
| `/api/v1/learning` | Module list, module detail |

## License

MIT
