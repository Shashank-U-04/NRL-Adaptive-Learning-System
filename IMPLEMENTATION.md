# NRL Adaptive Learning System — Implementation Reference

**Last updated**: 2026-05-13 | **Branch**: main | **Version**: 2.1.0

---

## Current Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts, Framer Motion |
| Backend | FastAPI 0.115, Python 3.11+, SQLAlchemy 2.0 async, Pydantic v2 |
| Database | PostgreSQL (Neon cloud) — async via asyncpg |
| Auth | Supabase Auth — JWT validated server-side with PyJWT (HS256, audience: "authenticated") |
| Adaptive Engine | 3-phase hybrid: safety rules → DQN (PyTorch, optional) → heuristic fallback |
| Content | Static JSON datasets — no external AI API dependency |

---

## Architecture Overview

### Authentication Flow

```
Browser  →  Supabase JS (signIn/signUp/signOut)
         →  Supabase issues JWT
         →  Frontend sends JWT in Authorization header
         →  Backend validates with SUPABASE_JWT_SECRET (PyJWT)
         →  On first login: auto-creates user row in DB (sync_user)
```

### Adaptive Engine (backend/app/adaptive/)

```
Request comes in with learner state (7 features):
  quiz_accuracy, recent_trend, topic_confidence,
  consecutive_correct, consecutive_wrong,
  session_count, difficulty_level

Phase 1: Safety rules  (deterministic, always override)
  → e.g. force easier if 3 consecutive wrong answers
Phase 2: DQN inference (if dqn_agent.pt weights present)
  → Neural policy with action masking
Phase 3: Heuristic fallback (always available)
  → Rule-based difficulty adjustment

Output: (action, confidence, explanation)
```

### Static Content Pipeline

Learning modules are defined in JSON files under `backend/app/data/` and `frontend/src/data/`. The `seed.py` script reads these and populates the `learning_modules` table. No AI generation — zero runtime API cost.

---

## Implemented Features

### Authentication
- Supabase sign-up and sign-in (email/password)
- JWT validated server-side — no bcrypt, no custom token management
- First-login auto-sync: creates DB user row from Supabase JWT claims
- GET /me — returns authenticated user profile
- PUT /profile — update display name, avatar

### Adaptive Quiz Sessions
- Start session by topic ID — creates session record
- Adaptive engine selects action: difficulty up/down/same, hint, next topic, review, explain
- Answer submission: records attempt, computes XP, triggers adaptive state update
- Session end: accuracy, total XP, duration summary
- Session history (last N sessions per user)

### Analytics
- Dashboard: total XP, streak, overall accuracy, sessions completed
- Weak topics detection (accuracy below threshold)
- Accuracy trend chart (per session over time)
- Recent session list

### Leaderboard
- Global ranking by total XP
- Topic-specific leaderboard
- Shows display name, XP, rank

### Learning Modules
- Module catalog (list all topics)
- Module detail with structured content blocks: text, MCQ, diagram, lab, scenario, summary
- Interactive lab panel (pattern matching simulation, no code execution)
- Inline quiz engine with immediate feedback

---

## API Endpoints

All routes prefixed with `/api/v1`.

### Auth — `/auth`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/profile` | Update display name / avatar |

### Sessions — `/sessions`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions/start` | Start adaptive learning session |
| POST | `/sessions/{id}/answer` | Submit answer, get feedback + next action |
| POST | `/sessions/{id}/end` | End session, get summary |
| GET | `/sessions/history` | Last N sessions for current user |

### Analytics — `/analytics`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/dashboard` | XP, streak, accuracy, weak topics |
| GET | `/analytics/trend` | Accuracy over time (chart data) |

### Leaderboard — `/leaderboard`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leaderboard` | Global XP leaderboard |
| GET | `/leaderboard/{topic_id}` | Topic-specific leaderboard |

### Learning — `/learning`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/learning/modules` | List all learning modules |
| GET | `/learning/modules/{id}` | Get module content |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/` | API root + links |

---

## Database Schema (key tables)

```
users           id (uuid, FK to Supabase auth.users), email, display_name,
                xp, streak, current_level, knowledge_state (JSON)

learning_modules id, topic, title, difficulty, content (JSON), order_index

sessions        id, user_id, topic_id, started_at, ended_at,
                accuracy, xp_earned, question_count

session_attempts id, session_id, question_id, is_correct, response_time_ms,
                 adaptive_action, reward

leaderboard     (view) user_id, display_name, total_xp, rank
```

---

## Frontend Pages

| Route | Page |
|-------|------|
| `/` | Landing page |
| `/login` | Supabase sign-in |
| `/register` | Supabase sign-up |
| `/dashboard` | XP, streak, analytics overview |
| `/learning` | Module catalog |
| `/session` | Active quiz session |
| `/analytics` | Charts, weak topics, trend |
| `/leaderboard` | Global rankings |
| `/profile` | User settings |

---

## Roadmap

### Near-term
- [ ] Run DB migration and full end-to-end boot test
- [ ] Seed database with initial cybersecurity modules
- [ ] Train DQN on simulated student trajectories → deploy `dqn_agent.pt`
- [ ] Add more content topics (network security, cryptography, OSINT)

### Medium-term
- [ ] Fly.io deployment for backend
- [ ] Vercel deployment for frontend
- [ ] CI: pytest + Next.js build on every PR

### Future
- [ ] Spaced repetition scheduling
- [ ] Per-topic weak area detection with targeted review sessions
- [ ] Multiplayer challenge mode (head-to-head quiz)
