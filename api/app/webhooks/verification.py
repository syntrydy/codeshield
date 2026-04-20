"""Constant-time HMAC-SHA256 signature verification for GitHub webhook payloads."""

import hashlib
import hmac


def verify_signature(body: bytes, header: str, secret: str) -> bool:
    """Return True if the X-Hub-Signature-256 header matches the body HMAC.

    Uses hmac.compare_digest for constant-time comparison to prevent timing attacks.
    Returns False (never raises) so the caller decides the HTTP response.
    """
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
