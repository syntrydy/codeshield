"""Tests for the runs read endpoints."""

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

_USER_ID = "00000000-0000-0000-0000-000000000001"
_PROJECT_ID = "00000000-0000-0000-0000-000000000002"
_RUN_ID = "00000000-0000-0000-0000-000000000003"

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1(), default_backend())
_PUBLIC_JWK: dict = {**json.loads(ECAlgorithm.to_jwk(_PRIVATE_KEY.public_key())), "kty": "EC"}


def _make_token() -> str:
    return jwt.encode(
        {"sub": _USER_ID, "exp": int(time.time()) + 3600},
        _PRIVATE_KEY,
        algorithm="ES256",
    )


_RUN = {
    "id": _RUN_ID,
    "project_id": _PROJECT_ID,
    "user_id": _USER_ID,
    "pr_number": 42,
    "pr_head_sha": "abc123",
    "status": "completed",
    "trigger_event": "opened",
    "total_cost_usd": 0.01,
    "total_input_tokens": 1000,
    "total_output_tokens": 200,
    "created_at": "2026-04-20T00:00:00+00:00",
    "started_at": "2026-04-20T00:00:01+00:00",
    "completed_at": "2026-04-20T00:01:00+00:00",
}


@pytest.fixture(autouse=True)
def patch_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.core.auth as auth_module
    monkeypatch.setattr(auth_module._jwks_cache, "_keys", [_PUBLIC_JWK])
    monkeypatch.setattr(auth_module._jwks_cache, "_fetched_at", float("inf"))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _make_chain(data: object) -> MagicMock:
    chain = MagicMock()
    for method in ("select", "eq", "order", "limit", "maybe_single"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value = MagicMock(data=data)
    return chain


@pytest.mark.anyio
async def test_list_runs_returns_200() -> None:
    fake_client = MagicMock()
    fake_client.table.side_effect = [
        _make_chain(data={"id": _PROJECT_ID}),
        _make_chain(data=[_RUN]),
    ]
    with patch("app.api.runs.get_anon_client", return_value=fake_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/projects/{_PROJECT_ID}/runs",
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 200
    assert resp.json()[0]["pr_number"] == 42


@pytest.mark.anyio
async def test_list_runs_unknown_project_returns_404() -> None:
    fake_client = MagicMock()
    fake_client.table.return_value = _make_chain(data=None)
    with patch("app.api.runs.get_anon_client", return_value=fake_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/projects/00000000-0000-0000-0000-000000000000/runs",
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_get_run_returns_200_with_findings_and_events() -> None:
    fake_client = MagicMock()
    fake_client.table.side_effect = [
        _make_chain(data=_RUN),
        _make_chain(data=[]),   # findings
        _make_chain(data=[]),   # events
    ]
    with patch("app.api.runs.get_anon_client", return_value=fake_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/runs/{_RUN_ID}",
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == _RUN_ID
    assert body["findings"] == []
    assert body["events"] == []


@pytest.mark.anyio
async def test_get_run_not_found_returns_404() -> None:
    fake_client = MagicMock()
    fake_client.table.return_value = _make_chain(data=None)
    with patch("app.api.runs.get_anon_client", return_value=fake_client):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/runs/00000000-0000-0000-0000-000000000000",
                headers={"Authorization": f"Bearer {_make_token()}"},
            )
    assert resp.status_code == 404
