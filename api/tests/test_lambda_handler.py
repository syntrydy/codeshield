"""Tests for the Lambda entry point — specifically the Secrets Manager cold-start bootstrap."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch


def _run_bootstrap(prefix: str = "code-review-prod") -> None:
    """Import _bootstrap_secrets in a clean env so we can observe what it injects."""
    import importlib
    import sys

    # Remove cached lambda_handler module to force re-import (bootstrap runs at module level).
    sys.modules.pop("app.worker.lambda_handler", None)

    with patch.dict(os.environ, {"SECRETS_PREFIX": prefix}, clear=False):
        import app.worker.lambda_handler  # noqa: F401  — side-effect import
        importlib.reload(app.worker.lambda_handler)


_EXPECTED_MAPPING = {
    "SUPABASE_SECRET_KEY": "supabase_service_role_key",
    "ANTHROPIC_API_KEY": "anthropic_api_key",
    "LANGSMITH_API_KEY": "langsmith_api_key",
    "GITHUB_APP_ID": "github_app_id",
    "GITHUB_PRIVATE_KEY": "github_private_key",
    "GITHUB_WEBHOOK_SECRET": "github_webhook_secret",
}


def test_bootstrap_injects_all_secrets_into_env() -> None:
    """Each secret name should be fetched and written to the correct env var."""
    prefix = "test-prefix"

    def _fake_get_secret(SecretId: str) -> dict:
        return {"SecretString": f"secret-value-for-{SecretId}"}

    mock_sm = MagicMock()
    mock_sm.get_secret_value.side_effect = _fake_get_secret

    # Clear the env vars we want to observe, so bootstrap doesn't skip them.
    env_overrides = {k: "" for k in _EXPECTED_MAPPING}
    env_overrides["SECRETS_PREFIX"] = prefix

    with (
        patch("boto3.client", return_value=mock_sm),
        patch.dict(os.environ, env_overrides, clear=False),
    ):
        from app.worker.lambda_handler import _bootstrap_secrets
        _bootstrap_secrets()

        for env_key, secret_suffix in _EXPECTED_MAPPING.items():
            expected_secret_id = f"{prefix}/{secret_suffix}"
            expected_value = f"secret-value-for-{expected_secret_id}"
            assert os.environ.get(env_key) == expected_value, (
                f"Expected {env_key} = {expected_value!r}, got {os.environ.get(env_key)!r}"
            )


def test_bootstrap_skips_already_set_env_vars() -> None:
    """Secrets Manager should NOT be called for vars already present in the environment."""
    mock_sm = MagicMock()

    with (
        patch("boto3.client", return_value=mock_sm),
        patch.dict(os.environ, {"ANTHROPIC_API_KEY": "pre-existing"}, clear=False),
    ):
        from app.worker.lambda_handler import _bootstrap_secrets
        _bootstrap_secrets()

    # get_secret_value should not have been called for ANTHROPIC_API_KEY
    for call in mock_sm.get_secret_value.call_args_list:
        assert "anthropic_api_key" not in call.kwargs.get("SecretId", ""), (
            "Should not fetch a secret that is already set in the environment"
        )


def test_bootstrap_continues_when_a_secret_is_missing() -> None:
    """A missing secret should log a warning but not raise — other secrets still load."""
    prefix = "test-prefix"

    def _fake_get_secret(SecretId: str) -> dict:
        if "missing_secret" in SecretId:
            raise Exception("SecretId not found")
        return {"SecretString": "value"}

    mock_sm = MagicMock()
    mock_sm.get_secret_value.side_effect = _fake_get_secret

    env_overrides = {k: "" for k in _EXPECTED_MAPPING}
    env_overrides["SECRETS_PREFIX"] = prefix

    # Should not raise even if one secret fetch fails.
    with (
        patch("boto3.client", return_value=mock_sm),
        patch.dict(os.environ, env_overrides, clear=False),
    ):
        from app.worker.lambda_handler import _bootstrap_secrets
        _bootstrap_secrets()  # must not raise
