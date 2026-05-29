"""Auth flow tests: Supabase JWT validation → /me endpoint."""

import pytest
import jwt as pyjwt

# Sentinel secret that matches the one set in conftest.py
_TEST_JWT_SECRET = "test-supabase-jwt-secret-sentinel"


def _make_supabase_token(sub: str, email: str) -> str:
    """Mint a minimal HS256 JWT that mimics a Supabase-issued token."""
    return pyjwt.encode(
        {"sub": sub, "email": email, "aud": "authenticated"},
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.mark.asyncio
async def test_me_first_login_creates_user(client):
    """GET /auth/me with a valid Supabase JWT auto-creates the user row."""
    token = _make_supabase_token(
        sub="00000000-0000-0000-0000-000000000001",
        email="alice@example.com",
    )
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["user"]["email"] == "alice@example.com"
    assert me["profile"] is not None


@pytest.mark.asyncio
async def test_me_second_login_returns_same_user(client):
    """Subsequent requests with the same sub do not duplicate the user row."""
    token = _make_supabase_token(
        sub="00000000-0000-0000-0000-000000000002",
        email="bob@example.com",
    )
    headers = {"Authorization": f"Bearer {token}"}

    r1 = await client.get("/api/v1/auth/me", headers=headers)
    r2 = await client.get("/api/v1/auth/me", headers=headers)

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["user"]["email"] == r2.json()["user"]["email"]


@pytest.mark.asyncio
async def test_me_missing_token_returns_401(client):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_invalid_token_returns_401(client):
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_wrong_secret_returns_401(client):
    token = pyjwt.encode(
        {"sub": "00000000-0000-0000-0000-000000000099", "email": "evil@example.com", "aud": "authenticated"},
        "wrong-secret",
        algorithm="HS256",
    )
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_token_missing_sub_returns_401(client):
    """A token with no `sub` claim must be rejected even if the signature is valid."""
    token = pyjwt.encode(
        {"email": "no-sub@example.com", "aud": "authenticated", "role": "authenticated"},
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_service_role_token_rejected(client):
    """Service-role tokens share the signing secret but must NOT impersonate users."""
    token = pyjwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000010",
            "email": "service@example.com",
            "role": "service_role",
            "aud": "https://example.supabase.co",
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_anon_role_token_rejected(client):
    """Anon (public) tokens must not be accepted as end-user credentials."""
    token = pyjwt.encode(
        {"sub": "anon", "role": "anon", "aud": "anon"},
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_accepts_aud_list_with_authenticated(client):
    """Some Supabase versions issue `aud` as a list — ensure that path works."""
    token = pyjwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000020",
            "email": "list-aud@example.com",
            "aud": ["authenticated", "https://example.supabase.co"],
        },
        _TEST_JWT_SECRET,
        algorithm="HS256",
    )
    r = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "list-aud@example.com"
