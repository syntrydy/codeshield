"""GitHub webhook handler: HMAC verification, idempotency check, debounce, and Celery dispatch."""

import logging
import uuid

from fastapi import APIRouter, Header, HTTPException, Request, Response, status

from app.core.cache import cache_set_nx
from app.core.config import get_settings
from app.core.supabase import get_service_client
from app.webhooks.verification import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter()

_IDEMPOTENCY_TTL = 86_400  # 24 hours
_IDEMPOTENCY_PREFIX = "delivery:"


def _mark_seen(delivery_id: str) -> bool:
    """Store the delivery ID in the cache. Returns True if this is the first time we see it."""
    return cache_set_nx(f"{_IDEMPOTENCY_PREFIX}{delivery_id}", _IDEMPOTENCY_TTL)


def _create_run(
    project: dict,  # type: ignore[type-arg]
    *,
    pr_number: int,
    pr_head_sha: str,
    pr_base_sha: str,
    action: str,
) -> str:
    """Insert a runs row (status=queued) and return the new run_id."""
    run_id = str(uuid.uuid4())
    get_service_client().table("runs").insert({
        "id": run_id,
        "project_id": project["id"],
        "user_id": project["user_id"],
        "pr_number": pr_number,
        "pr_head_sha": pr_head_sha,
        "pr_base_sha": pr_base_sha,
        "trigger_event": action,
        "status": "queued",
    }).execute()
    return run_id


def _dispatch_review(
    project: dict,  # type: ignore[type-arg]
    run_id: str,
    *,
    repo_full_name: str,
    pr_number: int,
    pr_head_sha: str,
    pr_base_sha: str,
) -> None:
    """Dispatch a review job (background thread locally, SQS in production)."""
    from app.worker.dispatch import dispatch_review

    pr_url = f"https://github.com/{repo_full_name}/pull/{pr_number}"

    installation = project.get("github_app_installations") or {}
    installation_id: int | None = installation.get("installation_id") if isinstance(installation, dict) else None

    dispatch_review(
        run_id=run_id,
        project_id=project["id"],
        installation_id=installation_id,
        repo_full_name=repo_full_name,
        pr_url=pr_url,
        pr_head_sha=pr_head_sha,
        pr_base_sha=pr_base_sha,
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

    elif x_github_event == "check_run":
        if payload.get("action") == "rerequested":
            _handle_check_run_rerequested(payload, x_github_delivery)

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
    pr = payload["pull_request"]
    run_id = _create_run(
        project,
        pr_number=pr_number,
        pr_head_sha=pr["head"]["sha"],
        pr_base_sha=pr["base"]["sha"],
        action=action,
    )

    logger.info(
        "Run created, queuing review",
        extra={"run_id": run_id, "repo": repo_full_name, "pr": pr_number, "action": action},
    )

    _dispatch_review(
        project,
        run_id,
        repo_full_name=repo_full_name,
        pr_number=pr_number,
        pr_head_sha=pr["head"]["sha"],
        pr_base_sha=pr["base"]["sha"],
    )


def _handle_check_run_rerequested(payload: dict, delivery_id: str) -> None:  # type: ignore[type-arg]
    """Re-queue a review when the user clicks Re-run on a GitHub Check Run."""
    check_run = payload.get("check_run", {})
    head_sha: str = check_run.get("head_sha", "")
    prs: list = check_run.get("pull_requests", [])  # type: ignore[type-arg]

    if not prs:
        logger.info(
            "check_run rerequested has no associated PRs — skipping",
            extra={"delivery": delivery_id},
        )
        return

    pr = prs[0]
    pr_number: int = pr["number"]
    pr_base_sha: str = pr["base"]["sha"]
    repo_full_name: str = payload["repository"]["full_name"]

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
            "No project found for repo — skipping rerun",
            extra={"repo": repo_full_name, "delivery": delivery_id},
        )
        return

    project = resp.data
    run_id = _create_run(
        project,
        pr_number=pr_number,
        pr_head_sha=head_sha,
        pr_base_sha=pr_base_sha,
        action="rerequested",
    )

    logger.info(
        "Rerun queued via check_run rerequested",
        extra={"run_id": run_id, "repo": repo_full_name, "pr": pr_number},
    )

    _dispatch_review(
        project,
        run_id,
        repo_full_name=repo_full_name,
        pr_number=pr_number,
        pr_head_sha=head_sha,
        pr_base_sha=pr_base_sha,
    )


def _handle_installation(payload: dict) -> None:  # type: ignore[type-arg]
    """Handle GitHub App installation lifecycle events."""
    action: str = payload.get("action", "")
    installation_id: int = payload["installation"]["id"]

    if action == "deleted" or action == "suspend":
        _delete_installation(installation_id=installation_id)
    else:
        logger.info("Installation event (no-op)", extra={"action": action, "installation_id": installation_id})


def _delete_installation(*, installation_id: int) -> None:
    """Remove the installation row and all associated projects."""
    client = get_service_client()

    install_row = (
        client.table("github_app_installations")
        .select("id")
        .eq("installation_id", installation_id)
        .maybe_single()
        .execute()
    )
    if not install_row.data:
        logger.warning("Uninstall event for unknown installation", extra={"installation_id": installation_id})
        return

    installation_row_id: str = install_row.data["id"]

    client.table("projects").delete().eq("installation_id", installation_row_id).execute()
    client.table("github_app_installations").delete().eq("id", installation_row_id).execute()

    logger.info("Installation deleted", extra={"installation_id": installation_id})


_DEFAULT_SPECIALISTS = ["security", "correctness", "performance", "style"]


def _handle_installation_repositories(payload: dict) -> None:  # type: ignore[type-arg]
    """Handle repository added/removed events for an installation."""
    action: str = payload.get("action", "")
    installation_id: int = payload["installation"]["id"]

    if action == "added":
        _upsert_repos_for_installation(
            installation_id=installation_id,
            repos=payload.get("repositories_added", []),
        )
    elif action == "removed":
        _remove_repos(repos=payload.get("repositories_removed", []))
    else:
        logger.info(
            "Installation repositories event (no-op)",
            extra={"action": action, "installation_id": installation_id},
        )


def _upsert_repos_for_installation(*, installation_id: int, repos: list) -> None:  # type: ignore[type-arg]
    """Upsert newly added repositories as projects, linked to the existing installation row."""
    if not repos:
        return

    client = get_service_client()
    install_row = (
        client.table("github_app_installations")
        .select("id, user_id")
        .eq("installation_id", installation_id)
        .maybe_single()
        .execute()
    )
    if not install_row.data:
        logger.warning(
            "No installation row found — cannot upsert repos",
            extra={"installation_id": installation_id},
        )
        return

    installation_row_id: str = install_row.data["id"]
    user_id: str = install_row.data["user_id"]

    for repo in repos:
        client.table("projects").upsert(
            {
                "user_id": user_id,
                "installation_id": installation_row_id,
                "github_repo_id": repo["id"],
                "github_repo_full_name": repo["full_name"],
                "default_branch": "main",
                "enabled_specialists": _DEFAULT_SPECIALISTS,
                "severity_threshold": "low",
                "review_output_locale": "en",
            },
            on_conflict="github_repo_id",
        ).execute()

    logger.info(
        "Repos upserted via installation_repositories webhook",
        extra={"installation_id": installation_id, "count": len(repos)},
    )


def _remove_repos(*, repos: list) -> None:  # type: ignore[type-arg]
    """Remove projects for repositories that were uninstalled."""
    if not repos:
        return

    client = get_service_client()
    for repo in repos:
        client.table("projects").delete().eq("github_repo_id", repo["id"]).execute()

    logger.info("Repos removed via installation_repositories webhook", extra={"count": len(repos)})
