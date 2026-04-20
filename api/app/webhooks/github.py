"""GitHub webhook handler: HMAC verification, idempotency check, debounce, and Celery dispatch."""

import logging
import uuid

from fastapi import APIRouter, Header, HTTPException, Request, Response, status

from app.core.config import get_settings
from app.core.redis import get_redis
from app.core.supabase import get_service_client
from app.webhooks.verification import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter()

_IDEMPOTENCY_TTL = 86_400  # 24 hours
_IDEMPOTENCY_PREFIX = "delivery:"


def _mark_seen(delivery_id: str) -> bool:
    """Store the delivery ID in Redis. Returns True if this is the first time we see it."""
    redis = get_redis()
    return bool(redis.set(f"{_IDEMPOTENCY_PREFIX}{delivery_id}", 1, ex=_IDEMPOTENCY_TTL, nx=True))


def _create_run(project: dict, payload: dict, action: str) -> str:  # type: ignore[type-arg]
    """Insert a runs row (status=queued) and return the new run_id."""
    pr = payload["pull_request"]
    run_id = str(uuid.uuid4())
    get_service_client().table("runs").insert({
        "id": run_id,
        "project_id": project["id"],
        "user_id": project["user_id"],
        "pr_number": pr["number"],
        "pr_head_sha": pr["head"]["sha"],
        "pr_base_sha": pr["base"]["sha"],
        "trigger_event": action,
        "status": "queued",
    }).execute()
    return run_id


def _dispatch_review(project: dict, run_id: str, payload: dict) -> None:  # type: ignore[type-arg]
    """Enqueue a review task on Celery."""
    from app.worker.tasks import review_pr  # local import avoids circular dependency at module load

    pr = payload["pull_request"]
    repo = payload["repository"]
    pr_url = f"https://github.com/{repo['full_name']}/pull/{pr['number']}"

    # Supabase returns the joined installation row as a nested dict
    installation = project.get("github_app_installations") or {}
    installation_id: int | None = installation.get("installation_id") if isinstance(installation, dict) else None

    review_pr.delay(
        run_id=run_id,
        project_id=project["id"],
        installation_id=installation_id,
        repo_full_name=repo["full_name"],
        pr_url=pr_url,
        pr_head_sha=pr["head"]["sha"],
        pr_base_sha=pr["base"]["sha"],
        locale=project.get("review_output_locale", "en"),
        enabled_specialists=project.get(
            "enabled_specialists", ["security", "correctness", "performance", "style"]
        ),
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
    """Look up the project, create a run row, and enqueue the review task."""
    repo_full_name: str = payload["repository"]["full_name"]
    pr_number: int = payload["pull_request"]["number"]
    action: str = payload["action"]

    # Look up the project by repo full name (service client bypasses RLS)
    resp = (
        get_service_client()
        .table("projects")
        .select("id, user_id, review_output_locale, enabled_specialists, github_app_installations(installation_id)")
        .eq("github_repo_full_name", repo_full_name)
        .maybe_single()
        .execute()
    )
    if resp.data is None:
        logger.warning(
            "No project found for repo — skipping review",
            extra={"repo": repo_full_name, "delivery": delivery_id},
        )
        return

    project = resp.data
    run_id = _create_run(project, payload, action)

    logger.info(
        "Run created, queuing review",
        extra={"run_id": run_id, "repo": repo_full_name, "pr": pr_number, "action": action},
    )

    _dispatch_review(project, run_id, payload)


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
