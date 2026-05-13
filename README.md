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

### 3. Database migration

Run this once against your PostgreSQL database (Supabase SQL editor or psql):

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users DROP COLUMN password_hash;
TRUNCATE users CASCADE;
```

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
│   └── train_dqn.py           # Offline DQN training script
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

The adaptive engine works without a trained model (falls back to heuristic). To train:

```bash
python train_dqn.py
# Saves weights to backend/app/ml/models/dqn_agent.pt
```

The engine auto-loads the weights at startup if the file exists.

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
