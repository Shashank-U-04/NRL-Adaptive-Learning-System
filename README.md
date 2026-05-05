# NRL Adaptive Learning System

AI-powered cybersecurity learning platform that adapts quiz difficulty in real-time using Reinforcement Learning.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Recharts, Framer Motion |
| Backend | FastAPI, Python 3.12, SQLAlchemy (async) |
| Database | SQLite (`backend/database.db`) |
| Auth | JWT (access + refresh), bcrypt |
| AI Engine | Hybrid Q-Learning + DQN + rule-based fallback |
| AI Content | OpenAI API with caching + provider abstraction |

## Quick Start (Windows)

**Prerequisites**: Python 3.12+, Node.js 20+

### 1. Clone & set up environment

```bash
git clone <repo-url>
cd NRL-Adaptive-Learning-System
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY and set SECRET_KEY
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python -m backend.seed          # seeds DB with topics and questions
uvicorn backend.app.main:app --reload
```

Backend: **http://localhost:8000** | Swagger docs: **http://localhost:8000/docs**

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: **http://localhost:3000**

### Docker (alternative)

```bash
docker-compose up --build
```

## Features

- Adaptive difficulty via Q-Learning + DQN hybrid engine
- JWT authentication with refresh tokens
- XP, streaks, and knowledge level tracking
- Global leaderboard
- AI-generated learning modules with DB caching
- Safe lab simulations (pattern matching, no code execution)
- Real-time analytics dashboards (Recharts)
- Fully responsive dark-mode UI

## Project Structure

```
NRL-Adaptive-Learning-System/
├── backend/
│   ├── app/
│   │   ├── api/routes/        # auth, sessions, analytics, leaderboard, learning
│   │   ├── core/              # config, database, logging, rate_limit, metrics
│   │   ├── ml/                # Q-agent, DQN model, student environment, training
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic schemas
│   │   └── services/          # auth, session, rl, ai_generation, ai_provider
│   ├── tests/
│   ├── requirements.txt
│   └── seed.py
├── frontend/
│   └── src/
│       ├── app/               # Next.js pages (dashboard, session, analytics, ...)
│       ├── components/        # Navbar, UI primitives
│       └── lib/               # api.ts, auth-context.tsx
├── .github/workflows/         # GitHub Actions CI
├── docker-compose.yml
└── IMPLEMENTATION.md          # Full feature list, API reference, roadmap
```

## Documentation

See **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** for:
- Complete API endpoint reference
- All implemented features
- Upgrade roadmap (Phases 1–4)
- Architectural decisions

## License

MIT
