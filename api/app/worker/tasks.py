"""Celery task that invokes the LangGraph review pipeline and writes results to Supabase."""

import logging

from celery import Task

from app.graph.graph import compiled_graph
from app.graph.state import ReviewState
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


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
    """Run the full LangGraph review pipeline for one pull request.

    Called by the webhook handler via _dispatch_review. Writes progress events
    and findings to Supabase via the service-role client (Day 4+).
    """
    logger.info("Review task started", extra={"run_id": run_id, "pr_url": pr_url})

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

    logger.info(
        "Review task completed",
        extra={
            "run_id": run_id,
            "verdict": result.get("final_review", {}).get("verdict"),
            "findings": len(result.get("findings", [])),
            "errors": len(result.get("specialist_errors", [])),
        },
    )

    return {
        "run_id": run_id,
        "verdict": result.get("final_review", {}).get("verdict"),
        "findings_count": len(result.get("findings", [])),
    }
