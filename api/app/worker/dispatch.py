"""Task dispatch: routes review jobs to a background thread (local) or SQS (production)."""

import json
import logging
import threading

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def dispatch_review(
    *,
    run_id: str,
    project_id: str,
    installation_id: int | None,
    repo_full_name: str,
    pr_url: str,
    pr_head_sha: str,
    pr_base_sha: str,
    locale: str,
    enabled_specialists: list[str],
) -> None:
    payload = {
        "run_id": run_id,
        "project_id": project_id,
        "installation_id": installation_id,
        "repo_full_name": repo_full_name,
        "pr_url": pr_url,
        "pr_head_sha": pr_head_sha,
        "pr_base_sha": pr_base_sha,
        "locale": locale,
        "enabled_specialists": enabled_specialists,
    }

    settings = get_settings()

    if settings.task_backend == "sqs":
        import boto3
        sqs = boto3.client("sqs", region_name=settings.aws_region)
        sqs.send_message(QueueUrl=settings.sqs_queue_url, MessageBody=json.dumps(payload))
        logger.info("Review dispatched to SQS", extra={"run_id": run_id})
    else:
        from app.worker.tasks import run_review
        thread = threading.Thread(target=run_review, kwargs=payload, daemon=True)
        thread.start()
        logger.info("Review dispatched to background thread", extra={"run_id": run_id})
