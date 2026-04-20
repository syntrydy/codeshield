"""GitHub webhook handler: HMAC verification, idempotency check, debounce, and Celery dispatch."""

import logging

from fastapi import APIRouter, Header, HTTPException, Request, Response, status

from app.core.config import get_settings
from app.core.redis import get_redis
from app.webhooks.verification import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter()

_IDEMPOTENCY_TTL = 86_400  # 24 hours
_IDEMPOTENCY_PREFIX = "delivery:"


def _mark_seen(delivery_id: str) -> bool:
    """Store the delivery ID in Redis. Returns True if this is the first time we see it."""
    redis = get_redis()
    return bool(redis.set(f"{_IDEMPOTENCY_PREFIX}{delivery_id}", 1, ex=_IDEMPOTENCY_TTL, nx=True))


def _dispatch_review(payload: dict) -> None:  # type: ignore[type-arg]
    """Enqueue a review task on Celery."""
    from app.worker.tasks import review_pr  # local import avoids circular dependency at module load

    pr = payload["pull_request"]
    repo = payload["repository"]
    pr_url = f"https://github.com/{repo['full_name']}/pull/{pr['number']}"

    review_pr.delay(
        run_id="",          # populated after DB row created — wired fully in Day 4
        project_id="",      # populated after DB lookup — wired fully in Day 4
        pr_url=pr_url,
        pr_head_sha=pr["head"]["sha"],
        pr_base_sha=pr["base"]["sha"],
        locale="en",        # populated from project settings in Day 4
        enabled_specialists=["security", "correctness", "performance", "style"],
    )


@router.post("/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str = Header(...),
    x_github_event: str = Header(...),
    x_github_delivery: str = Header(...),
) -> Response:
    body = await request.body()

    # 1. Verify HMAC signature — must be first, before reading body content
    settings = get_settings()
    if not verify_signature(body, x_hub_signature_256, settings.github_webhook_secret):
        logger.warning("Webhook signature verification failed", extra={"delivery": x_github_delivery})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    # 2. Idempotency — drop duplicates silently (GitHub retries expect 2xx)
    if not _mark_seen(x_github_delivery):
        logger.info("Duplicate delivery dropped", extra={"delivery": x_github_delivery})
        return Response(status_code=status.HTTP_200_OK)

    payload: dict = await request.json()  # type: ignore[type-arg]

    logger.info(
        "Webhook received",
        extra={"event": x_github_event, "delivery": x_github_delivery},
    )

    # 3. Route by event type
    if x_github_event == "pull_request":
        action = payload.get("action", "")
        if action in ("opened", "synchronize", "reopened"):
            _handle_pull_request(payload, x_github_delivery)
        # closed and other actions are no-ops in v1

    elif x_github_event == "installation":
        _handle_installation(payload)

    elif x_github_event == "installation_repositories":
        _handle_installation_repositories(payload)

    # All other event types: accept and ignore
    return Response(status_code=status.HTTP_202_ACCEPTED)


def _handle_pull_request(payload: dict, delivery_id: str) -> None:  # type: ignore[type-arg]
    """Create a run record and enqueue the review task."""
    repo_full_name: str = payload["repository"]["full_name"]
    pr_number: int = payload["pull_request"]["number"]
    action: str = payload["action"]

    logger.info(
        "Queuing review",
        extra={"repo": repo_full_name, "pr": pr_number, "action": action, "delivery": delivery_id},
    )

    try:
        _dispatch_review(payload)
    except NotImplementedError:
        # Expected until Day 3 — log and continue so the endpoint still returns 202
        logger.debug("Celery dispatch stub — review not enqueued yet")


def _handle_installation(payload: dict) -> None:  # type: ignore[type-arg]
    """Handle GitHub App installation lifecycle events."""
    action: str = payload.get("action", "")
    installation_id: int = payload["installation"]["id"]
    logger.info("Installation event", extra={"action": action, "installation_id": installation_id})
    # DB mutations wired in Day 4 (installation callback session)


def _handle_installation_repositories(payload: dict) -> None:  # type: ignore[type-arg]
    """Handle repository added/removed events for an installation."""
    action: str = payload.get("action", "")
    installation_id: int = payload["installation"]["id"]
    logger.info(
        "Installation repositories event",
        extra={"action": action, "installation_id": installation_id},
    )
    # DB mutations wired in Day 4
