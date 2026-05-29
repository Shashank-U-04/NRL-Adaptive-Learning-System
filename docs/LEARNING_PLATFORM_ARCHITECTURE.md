# NRL Adaptive Learning Platform Architecture

## Product Flow

Dashboard → Learning → Interactive module → Inline MCQs → Safe lab simulation → Adaptive quiz → Results and recommendations.

Learning Mode and Quiz Mode are intentionally separate:

- **Learning Mode** — served by the FastAPI backend's `/learning/*` routes.
  Content is stored in Postgres (`learning_modules` table), seeded from
  `backend/app/services/module_service.py`.
- **Quiz Mode** — FastAPI + adaptive RL engine through `/sessions/*` routes.
  Questions come from static JSON files under `backend/app/data/cybersecurity/<topic>/`.
- The handoff is explicit: the learner clicks `Start Quiz` after completing the module flow.

---

## Folder Structure

```text
backend/app/api/routes/learning.py         Learning mode API (modules, lab, mcq, progress)
backend/app/api/routes/sessions.py         Adaptive quiz session API
backend/app/services/session_service.py    Topic-aware RL quiz lifecycle
backend/app/services/module_service.py     Builds static module content for seeding
backend/app/adaptive/engine.py             3-phase adaptive engine (rules → DQN → heuristic)
backend/app/data/cybersecurity/            Static JSON question datasets (level1/2/3.json per topic)
backend/seed.py                            Seeds topics, questions, and learning modules

frontend/src/app/learning/page.tsx         Module browser + interactive runner
frontend/src/features/learning/            UI components: LessonViewer, LabPanel, QuizEngine, etc.
frontend/src/features/learning/types.ts    Module schema types (ServerModule, ServerLesson, etc.)
frontend/src/data/learning/catalog.json    Frontend module catalog (topic list with metadata)
frontend/src/lib/api.ts                    Typed API client for all backend endpoints
```

---

## Learning Module Schema

Modules stored in Postgres (`learning_modules.content` JSONB) follow this structure:

```json
{
  "id": "web-security",
  "topic_id": "web-security",
  "title": "Web Security",
  "description": "...",
  "difficulty": "beginner",
  "estimated_minutes": 18,
  "lessons": [
    {
      "id": "lesson-1",
      "title": "...",
      "content": "...",
      "checkpoints": []
    }
  ],
  "labs": [
    {
      "id": "lab-1",
      "title": "...",
      "description": "...",
      "instructions": [],
      "expectedOutcome": "...",
      "validationRules": [
        { "pattern": "...", "flags": "i", "response": "Correct!", "isWin": true }
      ]
    }
  ],
  "quizPool": []
}
```

---

## APIs

### Learning APIs

```http
GET  /api/v1/learning/modules                 List active modules
GET  /api/v1/learning/modules/{topic_id}      Get module detail
POST /api/v1/learning/mcq                     Record inline MCQ answer
POST /api/v1/learning/lab                     Validate lab submission
POST /api/v1/learning/progress/update         Update lesson/lab/quiz progress
GET  /api/v1/learning/progress/{topic_id}     Get user progress for topic
```

### Session APIs

```http
POST /api/v1/sessions/start      Start adaptive quiz session
POST /api/v1/sessions/answer     Submit answer, get next question + RL feedback
POST /api/v1/sessions/end        End session, get summary
GET  /api/v1/sessions/history    Last N completed sessions
```

---

## Lab Validation

Lab submissions are validated server-side against pre-defined rules — no code execution.

Lookup order:
1. Canonical `labs[]` entry whose `id` matches `lab_id` → uses `validationRules[]` if present
2. Any canonical lab with a non-empty `expectedOutcome` (fallback)
3. Legacy `content[]` lab block with `type == "lab"` (backwards compat)

Rule types: `contains` (substring), `regex` (safe regex via `re.search`).
Input is always lowercased and trimmed before comparison.

---

## Adaptive Engine

```
State vector (7 floats):
  quiz_accuracy, mcq_accuracy, lab_success_rate,
  recent_trend (encoded), attempts_count, avg_response_time, topic_confidence

Phase 1 — Safety rules   (always override neural policy)
Phase 2 — DQN inference  (requires backend/app/ml/models/dqn_agent.pt)
Phase 3 — Heuristic      (rule-based fallback, always available)
```

The engine is a singleton (`get_adaptive_engine()`). It loads PyTorch weights once at
startup and falls back gracefully when PyTorch is unavailable or the weights file is missing.
