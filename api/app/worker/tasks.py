"""Celery task that invokes the LangGraph review pipeline and writes results to Supabase."""

import logging
from datetime import datetime, timezone

from celery import Task

from app.graph.graph import compiled_graph
from app.graph.state import ReviewState
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _emit_event(run_id: str, event_type: str, payload: dict) -> None:  # type: ignore[type-arg]
    from app.core.supabase import get_service_client
    get_service_client().table("run_events").insert({
        "run_id": run_id,
        "event_type": event_type,
        "payload": payload,
    }).execute()


def _update_run_status(run_id: str, status: str, extra: dict | None = None) -> None:  # type: ignore[type-arg]
    from app.core.supabase import get_service_client
    updates: dict = {"status": status}  # type: ignore[type-arg]
    if status == "running":
        updates["started_at"] = _now()
    elif status in ("completed", "failed", "cancelled"):
        updates["completed_at"] = _now()
    if extra:
        updates.update(extra)
    get_service_client().table("runs").update(updates).eq("id", run_id).execute()


@celery_app.task(
    bind=True,
    name="app.worker.tasks.review_pr",
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
)
def review_pr(
    self: Task,
    run_id: str,
    project_id: str,
    pr_url: str,
    pr_head_sha: str,
    pr_base_sha: str,
    locale: str,
    enabled_specialists: list[str],
) -> dict:  # type: ignore[type-arg]
    """Run the full LangGraph review pipeline for one pull request."""
    logger.info("Review task started", extra={"run_id": run_id, "pr_url": pr_url})

    _update_run_status(run_id, "running")
    _emit_event(run_id, "run.started", {"pr_url": pr_url})

    try:
        state: ReviewState = {
            "run_id": run_id,
            "project_id": project_id,
            "pr_url": pr_url,
            "pr_head_sha": pr_head_sha,
            "pr_base_sha": pr_base_sha,
            "locale": locale,  # type: ignore[typeddict-item]
            "enabled_specialists": enabled_specialists,
            "plan": None,
            "changed_files": [],
            "findings": [],
            "specialist_errors": [],
            "final_review": None,
        }

        result = compiled_graph.invoke(state)

        final_review = result.get("final_review") or {}
        findings_count = len(result.get("findings", []))
        errors = result.get("specialist_errors", [])

        _update_run_status(run_id, "completed", {
            "total_input_tokens": 0,   # populated by LLM wrapper in Day 5
            "total_output_tokens": 0,
            "total_cost_usd": 0,
        })
        _emit_event(run_id, "run.completed", {
            "verdict": final_review.get("verdict"),
            "findings_count": findings_count,
            "specialist_errors": errors,
        })

        logger.info(
            "Review task completed",
            extra={
                "run_id": run_id,
                "verdict": final_review.get("verdict"),
                "findings": findings_count,
                "errors": len(errors),
            },
        )

        return {
            "run_id": run_id,
            "verdict": final_review.get("verdict"),
            "findings_count": findings_count,
        }

    except Exception as exc:
        _update_run_status(run_id, "failed", {"error_message": str(exc)})
        _emit_event(run_id, "run.failed", {"error": str(exc)})
        logger.error("Review task failed", extra={"run_id": run_id, "error": str(exc)})
        raise
