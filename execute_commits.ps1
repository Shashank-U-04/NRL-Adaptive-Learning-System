git init
git branch -M main
git remote add origin https://github.com/Shashank-U-04/NRL_AI-Powered-Adaptive-Learning-Platform.git

# 1. Add gitignore
git add .gitignore
git commit -m "chore: add comprehensive production .gitignore"

# 2. Add env example
git add .env.example
git commit -m "chore: add environment variable template"

# 3. Add core package structure
git add backend/app/__init__.py backend/app/core/__init__.py
git commit -m "refactor(backend): create core package structure"

# 4. Config
git add backend/app/core/config.py
git commit -m "refactor(backend): move config to core module"

# 5. Database
git add backend/app/core/database.py
git commit -m "refactor(backend): move database engine to core"

# 6. Security
git add backend/app/core/security.py
git commit -m "refactor(backend): move JWT security to core"

# 7. Deps & Session store
git add backend/app/core/dependencies.py backend/app/core/session_store.py
git commit -m "refactor(backend): move deps and session store to core"

# 8. Models
git add backend/app/models/
git commit -m "refactor(backend): move ORM models to models package"

# 9. Schemas
git add backend/app/schemas/
git commit -m "refactor(backend): move Pydantic schemas to schemas package"

# 10. Auth route
git add backend/app/api/routes/auth.py
git commit -m "refactor(backend): move auth router to api/routes"

# 11. Sessions route
git add backend/app/api/routes/sessions.py
git commit -m "refactor(backend): move sessions router to api/routes"

# 12. Analytics route
git add backend/app/api/routes/analytics.py
git commit -m "refactor(backend): move analytics router to api/routes"

# 13. Leaderboard route
git add backend/app/api/routes/leaderboard.py
git commit -m "refactor(backend): move leaderboard router to api/routes"

# 14. Services
git add backend/app/services/
git commit -m "refactor(backend): move services to app/services"

# 15. Main
git add backend/app/main.py
git commit -m "refactor(backend): move app entry point to app package"

# 16. Seed
git add backend/seed.py
git commit -m "refactor(backend): relocate database seeder"

# 17. ML package
git add backend/app/ml/
git commit -m "feat(ml): organize RL engine into ml package"

# 18. Requirements
git add backend/requirements.txt
git commit -m "chore(backend): move requirements to backend directory"

# 19. Scripts
git add scripts/
git commit -m "chore: move startup scripts to scripts directory"

# 20. Frontend pages and core configs
git add frontend/src/ frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add Next.js frontend with all pages"

# 21. Frontend build configs
git add frontend/tsconfig.json frontend/next.config.ts frontend/eslint.config.mjs frontend/postcss.config.mjs frontend/next-env.d.ts
git commit -m "chore(frontend): add TypeScript and build configuration"

# 22. Frontend gitignore
git add frontend/.gitignore
git commit -m "chore(frontend): add frontend .gitignore"

# 23. Frontend public assets
git add frontend/public/
git commit -m "chore(frontend): add public assets"

# 24. Docs
git add docs/
git commit -m "docs: add architecture and API documentation"

# 25. CI/CD
git add .github/
git commit -m "ci: add GitHub Actions CI workflow"

# 26. README
git add README.md RESTRUCTURE_PLAN.md
git commit -m "docs: update README with new project structure"

# 27. Tests
git add backend/tests/
git commit -m "test: add tests directory"

# 28. API Init
git add backend/app/api/__init__.py backend/app/api/routes/__init__.py
git commit -m "refactor(backend): initialize api modules"

# 29. Backend Init
git add backend/__init__.py
git commit -m "refactor(backend): initialize backend module"

# 30. Everything else
git add .
git commit -m "chore: stage remaining project files"

# Finally, push
git push -u origin main
