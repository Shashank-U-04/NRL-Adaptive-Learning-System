# NRL Adaptive Learning System

> Personalized learning that adapts to **your** pace using Reinforcement Learning.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, Recharts, Framer Motion |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy, Pydantic |
| **Database** | SQLite (local `database.db` file) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **AI Engine** | Q-Learning trained agent + rule-based fallback |
| **Sessions** | In-memory Python cache (no Redis needed) |

## Quick Start (Windows)

### Prerequisites
- **Python 3.12+** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 20+** — [nodejs.org](https://nodejs.org/)
- **VS Code** (recommended)

### 1. Clone & Install Backend

```bash
cd NRL
pip install -r requirements.txt
```

### 2. Seed the Database

```bash
python -m backend.seed
```

This creates `database.db` with 3 CS topics and 20 questions.

### 3. Start Backend

```bash
uvicorn backend.main:app --reload
```

Or double-click **`start_backend.bat`**

Backend runs at: **http://localhost:8000**
API Docs at: **http://localhost:8000/docs**

### 4. Install & Start Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Or double-click **`start_frontend.bat`**

Frontend runs at: **http://localhost:3000**

## Project Structure

```
NRL/
├── backend/                     ← FastAPI Backend
│   ├── main.py                  ← App entry point
│   ├── config.py                ← Environment config
│   ├── database.py              ← SQLite async engine
│   ├── security.py              ← JWT + bcrypt
│   ├── session_store.py         ← In-memory cache (replaces Redis)
│   ├── models.py                ← 8 SQLAlchemy ORM models
│   ├── schemas.py               ← All Pydantic schemas
│   ├── dependencies.py          ← Auth guards
│   ├── seed.py                  ← DB seeder
│   ├── routers/
│   │   ├── auth.py              ← Register, Login, Profile
│   │   ├── sessions.py          ← Start, Answer, End, History
│   │   ├── analytics.py         ← Dashboard, Accuracy, Topics
│   │   └── leaderboard.py       ← Global XP ranking
│   └── services/
│       ├── auth_service.py      ← User lifecycle
│       ├── session_service.py   ← Quiz flow + RL integration
│       └── rl_service.py        ← Hybrid RL engine
│
├── frontend/                    ← Next.js Frontend
│   └── src/
│       ├── app/
│       │   ├── page.tsx         ← Landing page
│       │   ├── login/           ← Login
│       │   ├── register/        ← Register
│       │   ├── dashboard/       ← Stats + charts
│       │   ├── session/         ← Adaptive quiz
│       │   ├── analytics/       ← Deep analytics
│       │   ├── leaderboard/     ← XP ranking
│       │   └── profile/         ← User profile
│       ├── components/
│       │   └── Navbar.tsx
│       └── lib/
│           ├── api.ts           ← API client
│           └── auth-context.tsx ← Auth state
│
├── trained_agent.pkl            ← Pre-trained Q-table
├── ai_engine/                   ← Original RL prototype
├── requirements.txt             ← Python deps
├── .env.example                 ← Environment template
├── start_backend.bat            ← Windows launcher
└── start_frontend.bat           ← Windows launcher
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh tokens |
| GET | `/api/v1/auth/me` | Current user + profile |
| PUT | `/api/v1/auth/profile` | Update profile |
| POST | `/api/v1/sessions/start` | Start adaptive quiz |
| POST | `/api/v1/sessions/answer` | Submit answer |
| POST | `/api/v1/sessions/end` | End session |
| GET | `/api/v1/sessions/history` | Past sessions |
| GET | `/api/v1/analytics/dashboard` | Dashboard stats |
| GET | `/api/v1/analytics/accuracy` | Accuracy trend |
| GET | `/api/v1/analytics/topics` | Topic mastery |
| GET | `/api/v1/leaderboard` | Global leaderboard |

## How the AI Works

The system uses a **hybrid recommendation engine**:

1. **Deterministic Safety Rules (70%)** — Prevent bad UX (e.g., hard questions for beginners, hints when disengaged)
2. **Q-Table Policy (30%)** — Learned from 1,000 training episodes, optimizes for long-term reward
3. **Rule-Based Fallback** — If no trained model exists, pure adaptive difficulty matching

Every recommendation includes an **explanation string** — no black-box decisions.

## Features

- 🧠 AI-powered adaptive difficulty
- 📊 Real-time analytics with 4 chart types
- 🔥 Streak tracking and XP system
- 🏆 Global leaderboard
- 💎 Glassmorphism dark theme
- 📱 Fully responsive
- ⚡ Explainable AI — see why every decision is made
- 🔐 JWT authentication
- 📂 SQLite — zero external dependencies

## License

MIT
