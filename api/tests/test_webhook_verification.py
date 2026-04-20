"""Unit tests for HMAC-SHA256 webhook signature verification."""

import hashlib
import hmac

from app.webhooks.verification import verify_signature

_SECRET = "test-webhook-secret"
_BODY = b'{"action": "opened"}'


def _make_sig(body: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_valid_signature_accepted() -> None:
    sig = _make_sig(_BODY, _SECRET)
    assert verify_signature(_BODY, sig, _SECRET) is True


def test_tampered_body_rejected() -> None:
    sig = _make_sig(_BODY, _SECRET)
    assert verify_signature(b"tampered body", sig, _SECRET) is False


def test_wrong_secret_rejected() -> None:
    sig = _make_sig(_BODY, "wrong-secret")
    assert verify_signature(_BODY, sig, _SECRET) is False


def test_malformed_header_rejected() -> None:
    assert verify_signature(_BODY, "not-a-valid-header", _SECRET) is False


def test_empty_body_with_correct_sig() -> None:
    empty = b""
    sig = _make_sig(empty, _SECRET)
    assert verify_signature(empty, sig, _SECRET) is True
