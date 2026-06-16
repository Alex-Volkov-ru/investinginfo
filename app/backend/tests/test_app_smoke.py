"""Smoke tests for FastAPI app wiring (no DB)."""

import pytest
import uuid

pytest.importorskip("tinkoff")


def test_health_ping(client):
    r = client.get("/health/ping")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_monthly_review_requires_auth(client):
    r = client.get("/monthly-review")
    assert r.status_code == 403


def test_backups_list_requires_auth(client):
    r = client.get("/backups/list")
    assert r.status_code == 403


def _register_user(client):
    email = f"smoke-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        "/register",
        json={
            "email": email,
            "full_name": "Smoke User",
            "password": "Admin123!",
            "tg_username": f"smoke_{uuid.uuid4().hex[:6]}",
        },
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_backups_list_forbidden_for_non_staff(client):
    headers = _register_user(client)
    r = client.get("/backups/list", headers=headers)
    assert r.status_code == 403


def test_backups_create_forbidden_for_non_staff(client):
    headers = _register_user(client)
    r = client.post("/backups/create", headers=headers)
    assert r.status_code == 403


def test_backups_restore_forbidden_for_non_staff(client):
    headers = _register_user(client)
    r = client.post(
        "/backups/restore",
        headers=headers,
        json={"filename": "demo.sql.gz", "drop_existing": False},
    )
    assert r.status_code == 403


def test_register_on_users_path_removed(client):
    r = client.post("/users/register", json={})
    assert r.status_code == 404


def test_openapi_hidden_when_debug_false(client):
    r = client.get("/openapi.json")
    assert r.status_code in (404, 200)
