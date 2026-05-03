# NRL Adaptive Learning Platform Architecture

## Product Flow

Dashboard -> Learning -> Interactive module -> Inline MCQs -> Safe lab simulation -> Adaptive quiz -> Results and recommendations.

Learning Mode and Quiz Mode are intentionally separate:

- Learning Mode is served by Next.js routes and APIs under `frontend/src/app/learning` and `frontend/src/app/api/learning`.
- Quiz Mode remains FastAPI + RL DQN through `/api/v1/sessions/*`.
- The handoff is explicit: the learner clicks `Start Quiz` after completing the module flow.

## Folder Structure

```text
frontend/src/app/learning/page.tsx                  Learning module browser/runner
frontend/src/app/api/learning/modules/route.ts      Module list API
frontend/src/app/api/learning/modules/[topicId]/    Topic module API
frontend/src/features/learning/types.ts             Flexible module schema
frontend/src/features/learning/components/          Renderer, MCQ, scenario, lab, summary
frontend/src/data/learning/modules/                 Curated module JSON
frontend/src/lib/server/ai-module-service.ts        AI generation + in-memory cache
backend/app/services/session_service.py             Topic-aware RL quiz handoff
backend/app/services/ai_question_service.py         DeepSeek fallback for quiz questions
backend/app/models/models.py                        Question source field
```

## Learning Module Schema

Modules use content blocks:

- `text`
- `image`
- `diagram`
- `mcq_inline`
- `scenario`
- `lab`
- `summary`

Sample module JSON lives at:

```text
frontend/src/data/learning/modules/web-security.json
```

## APIs

### Learning APIs

```http
GET /api/learning/modules
GET /api/learning/modules/:topicId
```

The topic route returns a curated module if present. If no curated module exists, it checks the server cache, then optionally calls OpenAI when `OPENAI_API_KEY` is configured, then falls back to a deterministic local generated module so the learning flow never breaks.

### Quiz APIs

```http
POST /api/v1/sessions/start
POST /api/v1/sessions/answer
POST /api/v1/sessions/end
```

`POST /sessions/start` accepts:

```json
{
  "topic": "web-security"
}
```

The backend stores `state["topic"]`, gets the RL action, maps it to difficulty, and fetches a question by `topic + difficulty`. If the local dataset has no question, it uses cached AI-generated questions from the database.

## AI Integration

### OpenAI Learning Module Generation

Set:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

Prompt shape:

```text
Generate a structured learning module for topic: {topic}
Include explanation text, 2 inline MCQs, 1 real-world scenario, 1 safe simulated cybersecurity lab if applicable, and a summary.
Return JSON with keys: topicId,title,description,difficulty,estimatedMinutes,content,quiz.
Content block types must be only: text,image,diagram,mcq_inline,scenario,lab,summary.
```

### DeepSeek Quiz Question Generation

Set:

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
```

DeepSeek is only used when no dataset question exists. Generated quiz questions are stored in the existing `questions` table with `source="ai"` and reused later.

## Lab Simulation

Labs are safe string-validation simulations. They never execute system commands or browser scripts. Lab block validation supports:

```text
contains:payload
regex:pattern
```

Examples:

- SQL injection: `contains:admin' --`
- XSS: `contains:<script>`
- Command injection: `contains:whoami`
- Authentication bypass: `contains:test`

## Analytics

Current implemented tracking:

- Quiz attempts
- Topic mastery via `LearnerMetric`
- XP, total attempts, total correct

Recommended next production upgrade:

- Persist inline MCQ/lab events from Learning Mode to a backend table/collection.
- Add per-module resume state.
- Use module completion and lab success to recommend next topics.

## Database

Current repo uses SQLite for FastAPI. For production, migrate to PostgreSQL:

- `users`
- `profiles`
- `topics`
- `questions(source: dataset | ai)`
- `sessions`
- `session_events`
- `question_attempts`
- `learner_metrics`
- `learning_events`
- `module_progress`

MongoDB is also valid for learning modules because content blocks are naturally document-shaped. If using MongoDB, keep quiz attempts and auth/profile data in PostgreSQL or move all analytics to a single warehouse later.

## Deployment

### Frontend

- Deploy `frontend/` to Vercel.
- Configure `NEXT_PUBLIC_API_URL` to point to the FastAPI backend.
- Add `OPENAI_API_KEY` only to server-side environment variables, not public env.

### Backend

- Deploy FastAPI to Render, Railway, Fly.io, or AWS ECS.
- Use PostgreSQL instead of SQLite for production.
- Run database migrations before serving traffic.

### Rate Limiting and Caching

- Rate-limit AI generation routes by user/IP.
- Keep curated modules as the first source.
- Cache generated modules server-side and eventually persist them in MongoDB/PostgreSQL.
- Cache generated quiz questions in the existing `questions` table.

### Security

- Do not execute lab input.
- Keep all labs simulation-only.
- Store API keys only in server-side env.
- Use short-lived access tokens and rotate refresh tokens in production.
