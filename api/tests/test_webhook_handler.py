"""Integration tests for the GitHub webhook handler endpoint."""

import hashlib
import hmac
import json
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

_SECRET = "test-webhook-secret"
_DELIVERY_ID = "abc-123-delivery"

_PR_PAYLOAD = {
    "action": "opened",
    "pull_request": {"number": 42, "head": {"sha": "abc"}, "base": {"sha": "def"}},
    "repository": {"full_name": "owner/repo", "id": 1},
    "installation": {"id": 99},
}

_INSTALL_PAYLOAD = {
    "action": "created",
    "installation": {"id": 99, "account": {"login": "owner", "type": "User"}},
}


def _sign(body: bytes, secret: str = _SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _headers(body: bytes, event: str = "pull_request", delivery: str = _DELIVERY_ID) -> dict:
    return {
        "X-Hub-Signature-256": _sign(body),
        "X-GitHub-Event": event,
        "X-GitHub-Delivery": delivery,
    }


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def mock_settings(monkeypatch):  # type: ignore[no-untyped-def]
    """Patch the webhook secret so the handler uses our test secret."""
    from app.core import config as cfg_module
    settings = cfg_module.get_settings()
    monkeypatch.setattr(settings, "github_webhook_secret", _SECRET)
    return settings


@pytest.fixture
def mock_redis():  # type: ignore[no-untyped-def]
    """Fake Redis that tracks seen delivery IDs in memory."""
    seen: set[str] = set()

    class FakeRedis:
        def set(self, key: str, value: object, ex: int = 0, nx: bool = False) -> bool:
            if nx and key in seen:
                return False
            seen.add(key)
            return True

        def get(self, key: str) -> None:
            return None

    with patch("app.webhooks.github.get_redis", return_value=FakeRedis()):
        yield FakeRedis()


@pytest.fixture(autouse=True)
def mock_celery_dispatch():  # type: ignore[no-untyped-def]
    """Prevent all tests in this module from hitting the real Celery broker."""
    with patch("app.worker.tasks.review_pr.delay") as mock_delay:
        yield mock_delay


@pytest.mark.anyio
async def test_valid_pr_opened_returns_202(mock_settings, mock_redis) -> None:  # type: ignore[no-untyped-def]
    body = json.dumps(_PR_PAYLOAD).encode()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/webhooks/github", content=body, headers=_headers(body))
    assert resp.status_code == 202


@pytest.mark.anyio
async def test_duplicate_delivery_returns_200(mock_settings, mock_redis) -> None:  # type: ignore[no-untyped-def]
    body = json.dumps(_PR_PAYLOAD).encode()
    headers = _headers(body)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/webhooks/github", content=body, headers=headers)
        r2 = await client.post("/webhooks/github", content=body, headers=headers)
    assert r1.status_code == 202
    assert r2.status_code == 200


@pytest.mark.anyio
async def test_bad_signature_returns_401(mock_settings, mock_redis) -> None:  # type: ignore[no-untyped-def]
    body = json.dumps(_PR_PAYLOAD).encode()
    bad_headers = {
        "X-Hub-Signature-256": "sha256=badsignature",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": "unique-bad-sig-delivery",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/webhooks/github", content=body, headers=bad_headers)
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_unsupported_event_returns_202(mock_settings, mock_redis) -> None:  # type: ignore[no-untyped-def]
    body = json.dumps({"zen": "Keep it logically awesome."}).encode()
    headers = _headers(body, event="ping", delivery="ping-delivery-id")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/webhooks/github", content=body, headers=headers)
    assert resp.status_code == 202


@pytest.mark.anyio
async def test_installation_event_accepted(mock_settings, mock_redis) -> None:  # type: ignore[no-untyped-def]
    body = json.dumps(_INSTALL_PAYLOAD).encode()
    headers = _headers(body, event="installation", delivery="install-delivery-id")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/webhooks/github", content=body, headers=headers)
    assert resp.status_code == 202
