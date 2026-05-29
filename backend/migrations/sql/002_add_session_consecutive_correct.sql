-- Migration 0002: persist Session.consecutive_correct
--
-- Run after 0001. Idempotent. Adds a default-0 column so existing
-- session rows don't need backfill.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS consecutive_correct INTEGER NOT NULL DEFAULT 0;
