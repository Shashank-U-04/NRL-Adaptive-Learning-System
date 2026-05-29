-- Migration 0001: add QuestionAttempt.source_question_id
--
-- Run once against your production Postgres before deploying the v2.1+
-- backend. Idempotent — safe to re-run.
--
-- psql:  psql "$DATABASE_URL" -f backend/migrations/sql/001_add_source_question_id.sql

ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS source_question_id VARCHAR(80);
