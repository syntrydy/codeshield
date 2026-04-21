"""Celery task that invokes the LangGraph review pipeline and writes results to Supabase."""

import contextlib
import logging
from datetime import UTC, datetime

from celery import Task

from app.graph.graph import compiled_graph
from app.graph.state import ReviewState
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(UTC).isoformat()


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


@celery_app.task(  # type: ignore[misc]
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
    installation_id: int | None,
    repo_full_name: str,
    pr_url: str,
    pr_head_sha: str,
    pr_base_sha: str,
    locale: str,
    enabled_specialists: list[str],
) -> dict:  # type: ignore[type-arg]
    """Run the full LangGraph review pipeline for one pull request."""
    from app.core.github import (
        create_check_run,
        findings_to_annotations,
        map_verdict_to_conclusion,
        update_check_run,
    )
    from app.core.supabase import get_service_client

    logger.info("Review task started", extra={"run_id": run_id, "pr_url": pr_url})

    # Create a queued Check Run on GitHub (best-effort — don't fail the task if GitHub is down)
    check_run_id: int | None = None
    if installation_id:
        try:
            check_run_id = create_check_run(
                installation_id=installation_id,
                repo_full_name=repo_full_name,
                head_sha=pr_head_sha,
                run_id=run_id,
            )
            get_service_client().table("runs").update(
                {"github_check_run_id": check_run_id}
            ).eq("id", run_id).execute()
            _emit_event(run_id, "github.check_run_updated", {"check_run_id": check_run_id, "status": "queued"})
        except Exception as exc:
            logger.warning("Failed to create Check Run", extra={"run_id": run_id, "error": str(exc)})

    _update_run_status(run_id, "running")
    _emit_event(run_id, "run.started", {"pr_url": pr_url})

    if installation_id and check_run_id:
        try:
            update_check_run(
                installation_id=installation_id,
                repo_full_name=repo_full_name,
                check_run_id=check_run_id,
                status="in_progress",
            )
            _emit_event(run_id, "github.check_run_updated", {"check_run_id": check_run_id, "status": "in_progress"})
        except Exception as exc:
            logger.warning("Failed to update Check Run to in_progress", extra={"run_id": run_id, "error": str(exc)})

    try:
        # Fetch project settings before graph invocation — specialists need severity_threshold
        project_resp = get_service_client().table("projects").select("severity_threshold").eq("id", project_id).maybe_single().execute()
        severity_threshold: str = (project_resp.data or {}).get("severity_threshold", "low")

        state: ReviewState = {
            "run_id": run_id,
            "project_id": project_id,
            "pr_url": pr_url,
            "pr_head_sha": pr_head_sha,
            "pr_base_sha": pr_base_sha,
            "locale": locale,  # type: ignore[typeddict-item]
            "enabled_specialists": enabled_specialists,
            "github_installation_id": installation_id,
            "repo_full_name": repo_full_name,
            "severity_threshold": severity_threshold,
            "plan": None,
            "changed_files": [],
            "findings": [],
            "specialist_errors": [],
            "final_review": None,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
        }

        result = compiled_graph.invoke(state)

        final_review = result.get("final_review") or {}
        findings: list[dict] = result.get("findings", [])  # type: ignore[type-arg]
        findings_count = len(findings)
        errors = result.get("specialist_errors", [])
        total_input = result.get("total_input_tokens", 0)
        total_output = result.get("total_output_tokens", 0)
        total_cost = _estimate_cost(total_input, total_output)

        _update_run_status(run_id, "completed", {
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_cost_usd": total_cost,
        })
        _emit_event(run_id, "run.completed", {
            "verdict": final_review.get("verdict"),
            "findings_count": findings_count,
            "specialist_errors": errors,
        })

        # Complete the Check Run on GitHub
        if installation_id and check_run_id:
            try:
                conclusion = map_verdict_to_conclusion(findings)
                annotations = findings_to_annotations(findings, severity_threshold)
                summary = final_review.get("summary", f"Review complete. {findings_count} finding(s) found.")
                update_check_run(
                    installation_id=installation_id,
                    repo_full_name=repo_full_name,
                    check_run_id=check_run_id,
                    status="completed",
                    conclusion=conclusion,
                    title="AI Code Review",
                    summary=summary,
                    annotations=annotations,
                )
                _emit_event(run_id, "github.check_run_updated", {
                    "check_run_id": check_run_id,
                    "status": "completed",
                    "conclusion": conclusion,
                })
            except Exception as exc:
                logger.warning("Failed to complete Check Run", extra={"run_id": run_id, "error": str(exc)})

        logger.info(
            "Review task completed",
            extra={
                "run_id": run_id,
                "verdict": final_review.get("verdict"),
                "findings": findings_count,
                "errors": len(errors),
                "input_tokens": total_input,
                "output_tokens": total_output,
                "cost_usd": total_cost,
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
        if installation_id and check_run_id:
            with contextlib.suppress(Exception):
                update_check_run(
                    installation_id=installation_id,
                    repo_full_name=repo_full_name,
                    check_run_id=check_run_id,
                    status="completed",
                    conclusion="failure",
                    title="AI Code Review",
                    summary=f"Review failed: {exc}",
                )
        logger.error("Review task failed", extra={"run_id": run_id, "error": str(exc)})
        raise


def _estimate_cost(input_tokens: int, output_tokens: int) -> float:
    """Rough cost estimate using Sonnet pricing ($3/M input, $15/M output)."""
    return round(input_tokens * 3e-6 + output_tokens * 15e-6, 6)
