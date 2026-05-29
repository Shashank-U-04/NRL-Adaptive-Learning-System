# Security Action Required

**Status:** ONE MANUAL ACTION REMAINING
**Updated:** 2026-05-29
**Severity:** CRITICAL

---

## What happened

A file `backend/test_jwt2.py` was previously committed to git history and contained
the **live Supabase JWT secret** for this project.

## What has been done ✅

| Action | Status |
|--------|--------|
| Leaked file deleted from working tree | Done |
| Git history rewritten (git-filter-repo) | Done — file no longer in any commit |
| CI gitleaks scope restored to full-history scan | Done — `secret-scan` job uses `fetch-depth: 0` |
| Gitleaks config tightened with custom Supabase rules | Done |

You can verify the file is gone from history:
```bash
git log --all --oneline -- backend/test_jwt2.py
# Expected: no output
```

---

## What you MUST still do ⚠️

### Rotate the JWT secret in Supabase (CRITICAL — not done yet)

Deleting the file and scrubbing history does **not** invalidate the secret.
Anyone who had access to the old history can still forge JWTs with the leaked key
until you rotate it in Supabase.

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com) → your project
2. **Project Settings → API → JWT Settings**
3. Click **"Generate a new secret"** → confirm
4. Copy the new secret
5. Update your local `.env`:
   ```
   SUPABASE_JWT_SECRET=<new-secret>
   ```
6. Update any deployed environments (Fly.io secrets, Vercel, etc.):
   ```bash
   flyctl secrets set SUPABASE_JWT_SECRET='<new-secret>'
   ```
7. Restart all running backend processes — they cache the secret at startup

**Effect:** All tokens issued before the rotation become invalid immediately.
Users will be signed out and need to log in again (this is expected behaviour).

---

## Verification

Once rotated:
1. Call any authenticated endpoint with an old token → should return 401
2. Sign in fresh → new token should work normally
3. Run `gitleaks detect --source . --redact --verbose` locally → should be clean

---

## Why the anon key is low concern

The Supabase anon key is public by design — it ships in the frontend bundle
and is protected by Supabase row-level security and rate limits. Only the
JWT *secret* matters: anyone with it can forge `authenticated` JWTs.
