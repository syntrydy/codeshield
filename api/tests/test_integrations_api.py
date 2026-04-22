"""Tests for the GitHub App install-callback endpoint."""

from __future__ import annotations

import json
import time
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import ASGITransport, AsyncClient
from jwt.algorithms import ECAlgorithm

from app.main import app

_USER_ID = "00000000-0000-0000-0000-000000000099"

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1(), default_backend())
_PUBLIC_JWK: dict = {**json.loads(ECAlgorithm.to_jwk(_PRIVATE_KEY.public_key())), "kty": "EC"}


def _make_token() -> str:
    return jwt.encode(
        {"sub": _USER_ID, "exp": int(time.time()) + 3600, "aud": "authenticated"},
        _PRIVATE_KEY,
        algorithm="ES256",
    )


@pytest.fixture(autouse=True)
def patch_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.core.auth as auth_module
    monkeypatch.setattr(auth_module._jwks_cache, "_keys", [_PUBLIC_JWK])
    monkeypatch.setattr(auth_module._jwks_cache, "_fetched_at", float("inf"))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _make_github_install_response() -> dict:
    return {
        "id": 12345,
        "account": {"login": "acme-org", "type": "Organization"},
    }


def _make_github_repos_response() -> dict:
    return {
        "repositories": [
            {"id": 111, "full_name": "acme-org/api", "default_branch": "main"},
            {"id": 222, "full_name": "acme-org/web", "default_branch": "develop"},
        ]
    }


def _make_sb_mock(install_row_id: str = "inst-001") -> MagicMock:
    """Supabase mock that handles both upsert calls."""
    install_chain = MagicMock()
    install_chain.execute.return_value = MagicMock(data=[{"id": install_row_id}])
    install_chain.upsert.return_value = install_chain

    project_chain = MagicMock()
    project_chain.execute.return_value = MagicMock(data=[{"id": "proj-001"}])
    project_chain.upsert.return_value = project_chain

    client = MagicMock()
    def _route(name: str) -> MagicMock:
        if name == "github_app_installations":
            return install_chain
        return project_chain
    client.table.side_effect = _route
    return client


# ── Happy path ────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_install_callback_success_upserts_and_returns_repo_count() -> None:
    sb_mock = _make_sb_mock()

    with (
        patch("app.api.integrations.get_service_client", return_value=sb_mock),
        patch("app.api.integrations._make_app_jwt", return_value="app.jwt"),
        patch("app.api.integrations.get_installation_token", return_value="install-token"),
        patch("httpx.Client") as mock_http,
    ):
        # First call → install details; second call → repos
        http_instance = mock_http.return_value.__enter__.return_value
        http_instance.get.side_effect = [
            MagicMock(status_code=200, json=lambda: _make_github_install_response(),
                      raise_for_status=lambda: None),
            MagicMock(status_code=200, json=lambda: _make_github_repos_response(),
                      raise_for_status=lambda: None),
        ]

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/integrations/github/install-callback",
                params={"installation_id": 12345, "setup_action": "install"},
                headers={"Authorization": f"Bearer {_make_token()}"},
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["repos_count"] == 2


# ── setup_action=request returns early without upsert ────────────────────────

@pytest.mark.anyio
async def test_install_callback_request_action_returns_pending() -> None:
    with patch("app.api.integrations.get_service_client") as mock_sb:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/integrations/github/install-callback",
                params={"installation_id": 12345, "setup_action": "request"},
                headers={"Authorization": f"Bearer {_make_token()}"},
            )

    assert resp.status_code == 200
    assert resp.json() == {"status": "pending", "repos_count": 0}
    mock_sb.assert_not_called()


# ── Input validation ──────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_install_callback_missing_installation_id_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/integrations/github/install-callback",
            params={"setup_action": "install"},
            headers={"Authorization": f"Bearer {_make_token()}"},
        )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_install_callback_invalid_setup_action_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/integrations/github/install-callback",
            params={"installation_id": 12345, "setup_action": "unknown_action"},
            headers={"Authorization": f"Bearer {_make_token()}"},
        )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_install_callback_zero_installation_id_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/integrations/github/install-callback",
            params={"installation_id": 0, "setup_action": "install"},
            headers={"Authorization": f"Bearer {_make_token()}"},
        )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_install_callback_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/integrations/github/install-callback",
            params={"installation_id": 12345, "setup_action": "install"},
        )
    assert resp.status_code == 403


# ── GitHub API error propagates as 502 ───────────────────────────────────────

@pytest.mark.anyio
async def test_install_callback_github_api_error_returns_502() -> None:
    import httpx as _httpx

    with (
        patch("app.api.integrations._make_app_jwt", return_value="app.jwt"),
        patch("httpx.Client") as mock_http,
    ):
        http_instance = mock_http.return_value.__enter__.return_value
        error_resp = MagicMock()
        error_resp.status_code = 404
        http_instance.get.return_value.raise_for_status.side_effect = (
            _httpx.HTTPStatusError("not found", request=MagicMock(), response=error_resp)
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/integrations/github/install-callback",
                params={"installation_id": 99999, "setup_action": "install"},
                headers={"Authorization": f"Bearer {_make_token()}"},
            )

    assert resp.status_code == 502
