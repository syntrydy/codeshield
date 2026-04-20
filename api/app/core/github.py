"""GitHub App authentication: JWT signing, installation token minting, and Redis caching."""

import logging
import time

import httpx
import jwt

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

_TOKEN_TTL_SECONDS = 55 * 60  # GitHub tokens live 60 min; refresh with a 5-min buffer
_REDIS_KEY_PREFIX = "gh:token:"


def _load_private_key() -> str:
    """Return the GitHub App private key as a PEM string.

    Local dev: read from GITHUB_PRIVATE_KEY_PATH.
    Production: key is pre-loaded into settings.github_private_key by the Secrets Manager
    loader (called at worker boot — not implemented until Day 7).
    """
    settings = get_settings()
    if settings.github_private_key:
        return settings.github_private_key
    if settings.github_private_key_path:
        with open(settings.github_private_key_path) as f:
            return f.read()
    raise RuntimeError(
        "GitHub App private key not configured. "
        "Set GITHUB_PRIVATE_KEY_PATH (local) or GITHUB_PRIVATE_KEY (production)."
    )


def _make_app_jwt() -> str:
    """Mint a short-lived JWT signed with the App private key for GitHub API auth."""
    settings = get_settings()
    now = int(time.time())
    payload = {
        "iat": now - 60,   # issued-at backdated 60s to account for clock skew
        "exp": now + 540,  # 9-minute expiry (GitHub max is 10 min)
        "iss": str(settings.github_app_id),
    }
    return jwt.encode(payload, _load_private_key(), algorithm="RS256")


def get_installation_token(installation_id: int) -> str:
    """Return a valid installation access token, using the Redis cache when possible.

    Mints a new token via the GitHub API when the cache is cold or near expiry.
    Raises httpx.HTTPStatusError on GitHub API errors.
    """
    redis = get_redis()
    cache_key = f"{_REDIS_KEY_PREFIX}{installation_id}"

    cached = redis.get(cache_key)
    if cached:
        return cached  # type: ignore[return-value]

    app_jwt = _make_app_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
    resp.raise_for_status()
    token: str = resp.json()["token"]

    redis.setex(cache_key, _TOKEN_TTL_SECONDS, token)
    logger.info("Minted new installation token", extra={"installation_id": installation_id})
    return token
