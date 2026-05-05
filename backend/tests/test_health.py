"""Smoke tests for system endpoints."""

import pytest


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert "version" in body


@pytest.mark.asyncio
async def test_root(client):
    r = await client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["docs"] == "/docs"


@pytest.mark.asyncio
async def test_ai_health(client):
    r = await client.get("/system/ai")
    assert r.status_code == 200
    body = r.json()
    assert "preferred" in body
    assert "providers" in body


@pytest.mark.asyncio
async def test_cost_report(client):
    r = await client.get("/system/cost")
    assert r.status_code == 200
    body = r.json()
    assert "months" in body
    assert "budget_usd" in body
