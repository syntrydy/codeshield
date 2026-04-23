"""AWS Lambda entry point for the review pipeline.

On cold start, fetches all secrets from Secrets Manager and injects them into
os.environ so pydantic-settings picks them up without any app code changes.
SECRETS_PREFIX env var controls which Secrets Manager path to read from
(default: code-review-prod).
"""

import json
import logging
import os

logger = logging.getLogger(__name__)


def _bootstrap_secrets() -> None:
    """Fetch secrets from Secrets Manager into os.environ on Lambda cold start."""
    import boto3

    prefix = os.environ.get("SECRETS_PREFIX", "code-review-prod")
    region = os.environ.get("AWS_REGION", "us-east-1")
    sm = boto3.client("secretsmanager", region_name=region)

    mapping = {
        "SUPABASE_SECRET_KEY":     f"{prefix}/supabase_service_role_key",
        "ANTHROPIC_API_KEY":       f"{prefix}/anthropic_api_key",
        "LANGSMITH_API_KEY":       f"{prefix}/langsmith_api_key",
        "GITHUB_APP_ID":           f"{prefix}/github_app_id",
        "GITHUB_APP_SLUG":         f"{prefix}/github_app_slug",
        "GITHUB_PRIVATE_KEY":      f"{prefix}/github_private_key",
        "GITHUB_WEBHOOK_SECRET":   f"{prefix}/github_webhook_secret",
    }

    for env_key, secret_name in mapping.items():
        if os.environ.get(env_key):
            continue  # already set (e.g. via Lambda env vars for non-secrets)
        try:
            os.environ[env_key] = sm.get_secret_value(SecretId=secret_name)["SecretString"]
        except Exception as exc:
            logger.warning("Could not load secret %s: %s", secret_name, exc)


# Bootstrap runs once per cold start, before any app imports that trigger Settings()
_bootstrap_secrets()

from app.worker.tasks import run_review  # noqa: E402 — must come after bootstrap


def handler(event: dict, context: object) -> None:
    for record in event.get("Records", []):
        body = json.loads(record["body"])
        run_id = body.get("run_id", "unknown")
        logger.info("Lambda processing review", extra={"run_id": run_id})
        run_review(**body)
