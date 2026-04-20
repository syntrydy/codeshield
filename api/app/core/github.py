"""GitHub App authentication: JWT signing, installation token minting, Check Run helpers."""

import logging
import time
from typing import Any

import httpx
import jwt

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

_TOKEN_TTL_SECONDS = 55 * 60  # GitHub tokens live 60 min; refresh with a 5-min buffer
_REDIS_KEY_PREFIX = "gh:token:"
_GH_API = "https://api.github.com"
_GH_ACCEPT = "application/vnd.github+json"
_GH_VERSION = "2022-11-28"
_MAX_ANNOTATIONS_PER_REQUEST = 50

_SEVERITY_TO_LEVEL = {
    "critical": "failure",
    "high": "failure",
    "medium": "warning",
    "low": "notice",
    "info": "notice",
}


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
        return cached.decode() if isinstance(cached, bytes) else str(cached)

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


def _installation_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": _GH_ACCEPT,
        "X-GitHub-Api-Version": _GH_VERSION,
    }


def create_check_run(
    *,
    installation_id: int,
    repo_full_name: str,
    head_sha: str,
    run_id: str,
) -> int:
    """Create a queued Check Run on GitHub and return its ID."""
    token = get_installation_token(installation_id)
    url = f"{_GH_API}/repos/{repo_full_name}/check-runs"
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            url,
            headers=_installation_headers(token),
            json={
                "name": "AI Code Review",
                "head_sha": head_sha,
                "status": "queued",
                "external_id": run_id,
            },
        )
    resp.raise_for_status()
    check_run_id: int = resp.json()["id"]
    logger.info(
        "Created Check Run",
        extra={"run_id": run_id, "check_run_id": check_run_id, "repo": repo_full_name},
    )
    return check_run_id


def update_check_run(
    *,
    installation_id: int,
    repo_full_name: str,
    check_run_id: int,
    status: str,
    conclusion: str | None = None,
    title: str | None = None,
    summary: str | None = None,
    annotations: list[dict[str, Any]] | None = None,
) -> None:
    """Update an existing Check Run. Paginates annotations 50 at a time."""
    token = get_installation_token(installation_id)
    url = f"{_GH_API}/repos/{repo_full_name}/check-runs/{check_run_id}"

    payload: dict[str, Any] = {"status": status}
    if conclusion:
        payload["conclusion"] = conclusion
    if title or summary:
        payload["output"] = {
            "title": title or "AI Code Review",
            "summary": summary or "",
            "annotations": (annotations or [])[:_MAX_ANNOTATIONS_PER_REQUEST],
        }

    with httpx.Client(timeout=15.0) as client:
        client.patch(url, headers=_installation_headers(token), json=payload).raise_for_status()

        # Paginate remaining annotations
        remaining = (annotations or [])[_MAX_ANNOTATIONS_PER_REQUEST:]
        offset = _MAX_ANNOTATIONS_PER_REQUEST
        while remaining:
            batch = remaining[:_MAX_ANNOTATIONS_PER_REQUEST]
            client.patch(
                url,
                headers=_installation_headers(token),
                json={"output": {"title": title or "AI Code Review", "summary": "", "annotations": batch}},
            ).raise_for_status()
            remaining = remaining[_MAX_ANNOTATIONS_PER_REQUEST:]
            offset += _MAX_ANNOTATIONS_PER_REQUEST

    logger.info(
        "Updated Check Run",
        extra={"check_run_id": check_run_id, "status": status, "conclusion": conclusion},
    )


def findings_to_annotations(
    findings: list[dict[str, Any]],
    severity_threshold: str,
) -> list[dict[str, Any]]:
    """Convert findings to GitHub Check Run annotation dicts, filtering below threshold."""
    order = ["info", "low", "medium", "high", "critical"]
    threshold_idx = order.index(severity_threshold) if severity_threshold in order else 0

    annotations = []
    for f in findings:
        severity = f.get("severity", "low")
        if order.index(severity) < threshold_idx:
            continue
        if not f.get("file_path") or f.get("line_start") is None:
            continue
        annotations.append({
            "path": f["file_path"],
            "start_line": f["line_start"],
            "end_line": f.get("line_end") or f["line_start"],
            "annotation_level": _SEVERITY_TO_LEVEL.get(severity, "notice"),
            "title": f.get("title", "Finding"),
            "message": f.get("explanation", ""),
            "raw_details": f.get("suggested_fix") or "",
        })
    return annotations


def map_verdict_to_conclusion(findings: list[dict[str, Any]]) -> str:
    """Map the worst finding severity to a GitHub Check Run conclusion."""
    severities = {f.get("severity", "info") for f in findings}
    if "critical" in severities or "high" in severities:
        return "action_required"
    if "medium" in severities:
        return "neutral"
    return "success"
