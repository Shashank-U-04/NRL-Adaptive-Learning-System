"""Auth flow tests: register → login → me."""

import pytest


@pytest.mark.asyncio
async def test_register_login_flow(client):
    payload = {
        "name": "Alice Tester",
        "email": "alice@example.com",
        "password": "TestPass123",
    }

    r = await client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201, r.text
    tokens = r.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    # Re-register should fail with 409
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409

    # Login
    r3 = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert r3.status_code == 200
    access = r3.json()["access_token"]

    # /me
    r4 = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert r4.status_code == 200
    me = r4.json()
    assert me["user"]["email"] == payload["email"]
    assert me["profile"] is not None


@pytest.mark.asyncio
async def test_login_invalid(client):
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "nope@example.com", "password": "WrongPass1"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_register_weak_password(client):
    r = await client.post(
        "/api/v1/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "weak"},
    )
    # Pydantic validation = 422
    assert r.status_code == 422
