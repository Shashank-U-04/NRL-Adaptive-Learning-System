# NRL Adaptive Learning System — Implementation Reference

**Last updated**: 2026-05-29 | **Branch**: main | **Version**: 2.1.0

---

## Current Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, Recharts, Framer Motion |
| Backend | FastAPI 0.115, Python 3.11+, SQLAlchemy 2.0 async, Pydantic v2 |
| Database | PostgreSQL (Neon cloud) — async via asyncpg |
| Auth | Supabase Auth — JWT validated server-side with PyJWT (HS256, audience: "authenticated") |
| Adaptive Engine | 3-phase hybrid: safety rules → DQN (PyTorch, optional) → heuristic fallback |
| Content | Static JSON datasets — no external AI API dependency |
| Migrations | Alembic — sync driver (psycopg2) strips +asyncpg at runtime |

---

## Architecture Overview

### Authentication Flow

```
Browser  →  Supabase JS (signIn/signUp/signOut)
         →  Supabase issues JWT
         →  Frontend sends JWT in Authorization header
         →  Backend validates with SUPABASE_JWT_SECRET (PyJWT)
         →  On first login: auto-creates user + profile row in DB (sync_user)
         →  On 401: frontend refreshes session once, retries, then signs out
```

### Adaptive Engine (`backend/app/adaptive/`)

```
Request comes in with learner state (7 features, encoded by app.ml.dqn_model.encode_state):
  quiz_accuracy, mcq_accuracy, lab_success_rate, recent_trend,
  attempts_count, avg_response_time, topic_confidence

Phase 1: Safety rules  (deterministic, always override)
  → e.g. force easier if accuracy < 40% and trend is declining
Phase 2: DQN inference (if dqn_agent.pt weights present)
  → Neural policy with action masking (e.g. block Move_To_Next_Topic
    when topic_confidence < 0.5)
Phase 3: Heuristic fallback (always available)
  → Rule-based difficulty adjustment from accuracy thresholds

Output: (action, confidence, explanation)

Note: `consecutive_correct` is tracked separately in session.consecutive_correct
(persisted to DB so cache misses / multi-worker restarts don't reset the streak).
`lab_success_rate` is updated only from learning-mode lab events; during pure
quiz sessions it remains at its initialised value.
```

### Static Content Pipeline

Learning modules are defined in `frontend/src/data/learning/catalog.json` (list) and
built server-side by `backend/app/services/module_service.py`. The `seed.py` script
populates the `learning_modules` table in Postgres. No AI generation — zero runtime API cost.

---

## Implemented Features

### Authentication
- Supabase sign-up and sign-in (email/password + Google OAuth)
- JWT validated server-side — no bcrypt, no custom token management
- First-login auto-sync: creates DB user + profile row from Supabase JWT claims
- GET /me — returns authenticated user + profile
- PUT /profile — update display name, daily goal

### Adaptive Quiz Sessions
- Start session by topic ID — validates topic has content, creates session record
- Adaptive engine selects action: difficulty up/down/same, hint, next topic, review, explain
- Answer submission: records attempt, computes XP, triggers adaptive state update
- Streak persisted to DB — survives worker restarts and cache evictions
- Session end: accuracy, total XP, duration summary
- Session history (last N sessions per user)

### Analytics
- Dashboard: total XP, streak, overall accuracy, sessions completed
- Weak topics detection (lowest mastery score, with topic slug for navigation)
- Accuracy trend chart (per session over time)
- Topic mastery breakdown

### Leaderboard
- Global ranking by total XP
- Shows display name, XP, knowledge level, accuracy

### Learning Modules
- Module catalog (all active topics with difficulty + time estimate)
- Module detail with structured content: lessons, labs, quizPool
- Interactive lab panel (pattern-matching validation, no code execution)
- Inline quiz engine with immediate feedback
- Progress tracking (completed lessons, labs, quiz scores)

---

## API Endpoints

All routes prefixed with `/api/v1`.

### Auth — `/auth`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Get current user + profile |
| PUT | `/auth/profile` | Update display name / daily goal |

### Sessions — `/sessions`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions/start` | Start adaptive quiz session |
| POST | `/sessions/answer` | Submit answer, get feedback + next question |
| POST | `/sessions/end` | End session, get summary |
| GET | `/sessions/history` | Last N sessions for current user |

### Analytics — `/analytics`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/dashboard` | XP, streak, accuracy, weak topics |
| GET | `/analytics/accuracy` | Per-session accuracy trend (chart data) |
| GET | `/analytics/topics` | Per-topic mastery scores |

### Leaderboard — `/leaderboard`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leaderboard` | Global XP leaderboard |

### Learning — `/learning`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/learning/modules` | List active learning modules |
| GET | `/learning/modules/{topic_id}` | Get module content |
| POST | `/learning/mcq` | Record inline MCQ answer |
| POST | `/learning/lab` | Validate lab submission |
| POST | `/learning/progress/update` | Update lesson/lab/quiz progress |
| GET | `/learning/progress/{topic_id}` | Get user progress for topic |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/` | API root + links |

---

## Database Schema (key tables)

```
users               id (uuid, matches Supabase auth.users.id), name, email,
                    role, is_active, created_at

profiles            user_id (FK → users.id), knowledge_level, current_streak,
                    longest_streak, total_xp, sessions_completed,
                    total_questions_answered, total_correct, daily_goal_minutes,
                    last_active

topics              id (slug, e.g. "web-security"), title, description,
                    order_index, is_active

learning_modules    id, topic_id (FK), content (JSONB), version,
                    is_active, is_ai_generated, created_at

sessions            id, user_id (FK), topic_id (FK), status, state_vector (JSONB),
                    total_steps, questions_answered, correct_answers, total_reward,
                    consecutive_correct, started_at, ended_at

question_attempts   id, session_id (FK), question_id (FK nullable),
                    source_question_id (for JSON dataset questions),
                    user_id (FK), selected_answer, is_correct,
                    time_taken_seconds, difficulty, created_at

learner_metrics     id, user_id (FK), topic_id (FK), mastery_score,
                    questions_attempted, questions_correct, avg_time_seconds,
                    last_practiced

session_events      id, session_id (FK), step_number, state_before (JSONB),
                    action_taken, reward, state_after (JSONB), explanation
```

---

## Frontend Pages

| Route | Page |
|-------|------|
| `/` | Landing page |
| `/login` | Supabase sign-in |
| `/register` | Supabase sign-up |
| `/auth/callback` | OAuth callback handler |
| `/dashboard` | XP, streak, analytics overview |
| `/learning` | Module catalog + interactive runner |
| `/session` | Active adaptive quiz session |
| `/analytics` | Charts, weak topics, accuracy trend |
| `/leaderboard` | Global rankings |
| `/profile` | User settings + password change |

---

## Migrations (Alembic)

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Check current revision
alembic current

# Generate new migration after ORM change
alembic revision --autogenerate -m "describe_change"
```

Migration files live in `backend/migrations/versions/`. Alembic strips `+asyncpg` from
`DATABASE_URL` automatically in `migrations/env.py` so the sync driver works.

---

## Roadmap

### Remaining / In Progress
- [ ] DQN training on real student trajectories → replace the stub `dqn_agent.pt`
- [ ] Add more content topics (network security, cryptography full lesson sets)

### Future
- [ ] Spaced repetition scheduling
- [ ] Per-topic weak area detection with targeted review sessions
- [ ] Multiplayer challenge mode (head-to-head quiz)
- [ ] Redis for session cache (currently in-process dict; fine for single-worker)
