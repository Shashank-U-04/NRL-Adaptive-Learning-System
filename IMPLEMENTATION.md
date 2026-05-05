# NRL Adaptive Learning System — Implementation Reference

**Last updated**: 2026-05-05 | **Branch**: main | **Status**: Active development

---

## Current Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts, Framer Motion |
| Backend | FastAPI, Python 3.12, SQLAlchemy (async), Pydantic v2 |
| Database | SQLite (`backend/database.db`) — async via aiosqlite |
| Auth | JWT (access + refresh tokens), bcrypt |
| AI Engine | Hybrid: Q-Learning agent + DQN model + rule-based fallback |
| AI Content | OpenAI API (with caching) + provider abstraction layer |
| Sessions | In-memory Python dict cache (no Redis) |

---

## Implemented Features

### Authentication
- Register with email + password (bcrypt hashed)
- Login returns JWT access + refresh tokens
- Token refresh endpoint
- Protected routes via `get_current_user` dependency
- User profile read/update

### Adaptive Quiz Sessions
- Start session by topic name or ID (auto-creates missing topics)
- Q-Learning + DQN hybrid selects next question difficulty
- Answer submission returns: is_correct, xp_earned, explanation, next_question
- Session end computes accuracy, total XP, duration
- Session history (last N sessions)
- In-memory session cache for active sessions

### Analytics
- Dashboard: XP, streak, accuracy, sessions completed, weak topics, recent sessions
- Accuracy trend over time (per session)
- Topic mastery scores (per topic)

### Leaderboard
- Global XP ranking with pagination

### Learning Modules
- List modules with pagination (GET /learning/modules)
- Fetch or AI-generate module for a topic (GET /learning/modules/{topic_id})
- Inline MCQ submission (POST /learning/mcq)
- Lab submission validation — safe pattern matching, no code execution (POST /learning/lab)
- Mark module completed (POST /learning/complete)

### Gamification
- XP earned per correct answer (tracked on UserProfile)
- Daily streak tracking (current + longest)
- Knowledge level classification (beginner / intermediate / advanced)

### AI / ML Layer
- `rl_service.py`: Hybrid recommender — deterministic safety rules + Q-table policy
- `ai_provider.py`: Multi-provider abstraction (OpenAI, fallback-ready)
- `ai_generation_service.py`: Generate learning module content via AI, with DB caching
- `ai_question_service.py`: AI-assisted question generation
- `backend/app/ml/`: Q-agent, DQN model, student environment (v1 + v2), training scripts

### Infrastructure
- Docker support: `backend/Dockerfile`, `docker-compose.yml`
- Fly.io config: `backend/fly.toml`
- Structured logging: `backend/app/core/logging_config.py`
- Rate limiting: `backend/app/core/rate_limit.py`
- Cost tracker: `backend/app/core/cost_tracker.py`
- Metrics: `backend/app/core/metrics.py`
- CI: `.github/workflows/` (GitHub Actions)

---

## API Endpoints

All routes are prefixed `/api/v1`.

### Auth (`/api/v1/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create user account |
| POST | `/auth/login` | Login, returns JWT tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user + profile |
| PUT | `/auth/profile` | Update profile |

### Sessions (`/api/v1/sessions`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions/start` | Start adaptive quiz session |
| POST | `/sessions/answer` | Submit answer, get next question |
| POST | `/sessions/end` | End session, get summary |
| GET | `/sessions/history` | Past sessions (limit param) |

### Analytics (`/api/v1/analytics`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/dashboard` | XP, streak, accuracy, weak topics |
| GET | `/analytics/accuracy` | Accuracy per session (trend) |
| GET | `/analytics/topics` | Topic mastery scores |

### Leaderboard (`/api/v1/leaderboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leaderboard` | Global XP ranking |

### Learning (`/api/v1/learning`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/learning/modules` | Paginated module list |
| GET | `/learning/modules/{topic_id}` | Fetch or AI-generate module |
| POST | `/learning/mcq` | Submit inline MCQ answer |
| POST | `/learning/lab` | Submit lab answer (safe pattern match) |
| POST | `/learning/complete` | Mark module completed |

---

## Frontend Pages

| Route | File | Status |
|-------|------|--------|
| `/` | `app/page.tsx` | Landing page |
| `/login` | `app/login/` | Auth form |
| `/register` | `app/register/` | Auth form |
| `/dashboard` | `app/dashboard/` | Stats + charts |
| `/session` | `app/session/` | Adaptive quiz |
| `/analytics` | `app/analytics/` | Deep analytics |
| `/leaderboard` | `app/leaderboard/` | XP ranking |
| `/learning` | `app/learning/` | Browse modules |
| `/profile` | `app/profile/` | User profile |

---

## Upgrade Roadmap

### Phase 1 — Foundation (Weeks 1–4) `in progress`
- [x] Docker containerization (backend + compose)
- [x] Fly.io deployment config
- [x] Structured logging + metrics + rate limiting
- [x] GitHub Actions CI setup
- [ ] Full CI/CD pipeline (test → build → deploy)
- [ ] Terraform / IaC modules

### Phase 2 — Database & Caching (Weeks 5–8)
- [ ] Migrate SQLite → Neon PostgreSQL (free tier, 500MB)
- [ ] Alembic migration framework
- [ ] Session cache persistence (SQLite TTL layer)
- [ ] Connection pooling + query index tuning

### Phase 3 — Production Deployment (Weeks 9–11)
- [ ] Fly.io live deployment
- [ ] Automated deploys via GitHub Actions
- [ ] SSL, health checks, alert rules
- [ ] Runbook documentation

### Phase 4 — AI Cost Optimization (Weeks 12–16)
- [ ] Semantic caching for AI-generated content (>80% cache hit target)
- [ ] Local LLM fallback (Ollama) when OpenAI quota exhausted
- [ ] Cost tracking alerts ($10/month threshold)
- [ ] Advanced analytics (difficulty calibration, cohort analysis)

---

## Key Architectural Decisions

- **SQLite over PostgreSQL for now**: Zero external dependencies for local dev; Neon migration planned for Phase 2
- **In-memory session cache**: Avoids Redis cost; sufficient for current load; will add TTL persistence in Phase 2
- **Hybrid AI recommender**: Safety rules prevent bad UX (70%), Q-table optimizes long-term reward (30%); every decision is human-readable
- **Multi-provider AI abstraction**: `ai_provider.py` decouples from OpenAI, enabling future Ollama/DeepSeek fallback without touching session logic
