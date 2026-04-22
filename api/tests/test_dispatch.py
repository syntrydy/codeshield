"""Tests for the task dispatch layer — local thread and SQS backends."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, call, patch

import pytest

from app.worker.dispatch import dispatch_review

_PAYLOAD = {
    "run_id": "run-001",
    "project_id": "proj-001",
    "installation_id": 42,
    "repo_full_name": "owner/repo",
    "pr_url": "https://github.com/owner/repo/pull/1",
    "pr_head_sha": "deadbeef",
    "pr_base_sha": "abc123",
    "locale": "en",
    "enabled_specialists": ["security", "correctness"],
}


# ── Local (thread) backend ────────────────────────────────────────────────────

def test_local_backend_starts_daemon_thread() -> None:
    with (
        patch("app.worker.dispatch.get_settings") as mock_settings,
        patch("app.worker.dispatch.threading.Thread") as mock_thread_cls,
    ):
        mock_settings.return_value.task_backend = "local"
        mock_thread_instance = MagicMock()
        mock_thread_cls.return_value = mock_thread_instance

        dispatch_review(**_PAYLOAD)

        mock_thread_cls.assert_called_once()
        _, kwargs = mock_thread_cls.call_args
        assert kwargs.get("daemon") is True
        mock_thread_instance.start.assert_called_once()


def test_local_backend_passes_run_id_in_thread_kwargs() -> None:
    with (
        patch("app.worker.dispatch.get_settings") as mock_settings,
        patch("app.worker.dispatch.threading.Thread") as mock_thread_cls,
    ):
        mock_settings.return_value.task_backend = "local"
        mock_thread_cls.return_value = MagicMock()

        dispatch_review(**_PAYLOAD)

        _, kwargs = mock_thread_cls.call_args
        assert kwargs["kwargs"]["run_id"] == _PAYLOAD["run_id"]
        assert kwargs["kwargs"]["locale"] == _PAYLOAD["locale"]


# ── SQS backend ──────────────────────────────────────────────────────────────

def _sqs_settings() -> MagicMock:
    s = MagicMock()
    s.task_backend = "sqs"
    s.sqs_queue_url = "https://sqs.us-east-1.amazonaws.com/123/reviews"
    s.aws_region = "us-east-1"
    return s


def test_sqs_backend_sends_message_to_queue() -> None:
    mock_sqs = MagicMock()

    with (
        patch("app.worker.dispatch.get_settings", return_value=_sqs_settings()),
        patch("boto3.client", return_value=mock_sqs),
    ):
        dispatch_review(**_PAYLOAD)

    mock_sqs.send_message.assert_called_once()
    call_kwargs = mock_sqs.send_message.call_args.kwargs
    assert call_kwargs["QueueUrl"] == "https://sqs.us-east-1.amazonaws.com/123/reviews"


def test_sqs_backend_serialises_payload_as_json() -> None:
    mock_sqs = MagicMock()

    with (
        patch("app.worker.dispatch.get_settings", return_value=_sqs_settings()),
        patch("boto3.client", return_value=mock_sqs),
    ):
        dispatch_review(**_PAYLOAD)

    call_kwargs = mock_sqs.send_message.call_args.kwargs
    body = json.loads(call_kwargs["MessageBody"])
    assert body["run_id"] == _PAYLOAD["run_id"]
    assert body["enabled_specialists"] == _PAYLOAD["enabled_specialists"]
    assert body["locale"] == _PAYLOAD["locale"]


def test_sqs_backend_does_not_start_thread() -> None:
    mock_sqs = MagicMock()

    with (
        patch("app.worker.dispatch.get_settings", return_value=_sqs_settings()),
        patch("boto3.client", return_value=mock_sqs),
        patch("app.worker.dispatch.threading.Thread") as mock_thread_cls,
    ):
        dispatch_review(**_PAYLOAD)

    mock_thread_cls.assert_not_called()
