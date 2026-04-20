"""Tests for the projects CRUD endpoints."""

import time
from unittest.mock import MagicMock, patch

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

_JWT_SECRET = "test-secret"
_USER_ID = "00000000-0000-0000-0000-000000000001"


def _make_token(user_id: str = _USER_ID) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": int(time.time()) + 3600},
        _JWT_SECRET,
        algorithm="HS256",
    )


_PROJECT = {
    "id": "00000000-0000-0000-0000-000000000002",
    "user_id": _USER_ID,
    "github_repo_full_name": "owner/repo",
    "default_branch": "main",
    "enabled_specialists": ["security", "style"],
    "severity_threshold": "low",
    "review_output_locale": "en",
    "created_at": "2026-04-20T00:00:00+00:00",
}


@pytest.fixture(autouse=True)
def patch_jwt_secret(monkeypatch):  # type: ignore[no-untyped-def]
    settings = __import__("app.core.config", fromlist=["get_settings"]).get_settings()
    monkeypatch.setattr(settings, "supabase_jwt_secret", _JWT_SECRET)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def fake_anon_client() -> MagicMock:
    client = MagicMock()
    chain = client.table.return_value
    for method in ("select", "eq", "order", "limit", "maybe_single", "update"):
        getattr(chain, method).return_value = chain
    return client


@pytest.mark.anyio
async def test_list_projects_returns_200(fake_anon_client: MagicMock) -> None:
    fake_anon_client.table.return_value.execute.return_value = MagicMock(data=[_PROJECT])
    with patch("app.api.projects.get_anon_client", return_value=fake_anon_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/projects", headers={"Authorization": f"Bearer {_make_token()}"}
            )
    assert resp.status_code == 200
    assert resp.json()[0]["github_repo_full_name"] == "owner/repo"


@pytest.mark.anyio
async def test_list_projects_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/projects")
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_get_project_returns_200(fake_anon_client: MagicMock) -> None:
    fake_anon_client.table.return_value.execute.return_value = MagicMock(data=_PROJECT)
    with patch("app.api.projects.get_anon_client", return_value=fake_anon_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/projects/{_PROJECT['id']}",  # noqa: E501
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 200
    assert resp.json()["id"] == _PROJECT["id"]


@pytest.mark.anyio
async def test_get_project_not_found_returns_404(fake_anon_client: MagicMock) -> None:
    fake_anon_client.table.return_value.execute.return_value = MagicMock(data=None)
    with patch("app.api.projects.get_anon_client", return_value=fake_anon_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/projects/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_project_returns_200(fake_anon_client: MagicMock) -> None:
    updated = {**_PROJECT, "severity_threshold": "high"}
    fake_anon_client.table.return_value.execute.return_value = MagicMock(data=[updated])
    with patch("app.api.projects.get_anon_client", return_value=fake_anon_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.patch(
                f"/projects/{_PROJECT['id']}",
                json={"severity_threshold": "high"},
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 200
    assert resp.json()["severity_threshold"] == "high"


@pytest.mark.anyio
async def test_update_project_empty_body_returns_422(fake_anon_client: MagicMock) -> None:
    with patch("app.api.projects.get_anon_client", return_value=fake_anon_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.patch(
                f"/projects/{_PROJECT['id']}",
                json={},
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 422
