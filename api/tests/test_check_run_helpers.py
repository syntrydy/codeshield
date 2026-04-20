"""Tests for GitHub Check Run create/update helpers and annotation mapping."""

from unittest.mock import MagicMock, patch

import pytest

from app.core.github import (
    create_check_run,
    findings_to_annotations,
    map_verdict_to_conclusion,
    update_check_run,
)

_INSTALLATION_ID = 99
_REPO = "owner/repo"
_HEAD_SHA = "abc123"
_RUN_ID = "00000000-0000-0000-0000-000000000001"
_CHECK_RUN_ID = 42


def _mock_token() -> MagicMock:
    mock = MagicMock()
    mock.get.return_value = None
    mock.setex.return_value = True
    return mock


def _mock_response(json_data: object, status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status.return_value = None
    return resp


@pytest.fixture(autouse=True)
def patch_installation_token() -> MagicMock:  # type: ignore[return]
    with patch("app.core.github.get_installation_token", return_value="tok") as m:
        yield m


def test_create_check_run_returns_id() -> None:
    mock_resp = _mock_response({"id": _CHECK_RUN_ID})
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp

    with patch("app.core.github.httpx.Client", return_value=mock_client):
        result = create_check_run(
            installation_id=_INSTALLATION_ID,
            repo_full_name=_REPO,
            head_sha=_HEAD_SHA,
            run_id=_RUN_ID,
        )

    assert result == _CHECK_RUN_ID
    mock_client.post.assert_called_once()
    call_json = mock_client.post.call_args.kwargs["json"]
    assert call_json["status"] == "queued"
    assert call_json["head_sha"] == _HEAD_SHA
    assert call_json["external_id"] == _RUN_ID


def test_update_check_run_completed() -> None:
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.patch.return_value = mock_resp

    with patch("app.core.github.httpx.Client", return_value=mock_client):
        update_check_run(
            installation_id=_INSTALLATION_ID,
            repo_full_name=_REPO,
            check_run_id=_CHECK_RUN_ID,
            status="completed",
            conclusion="success",
            title="AI Code Review",
            summary="All good.",
        )

    mock_client.patch.assert_called_once()
    call_json = mock_client.patch.call_args.kwargs["json"]
    assert call_json["status"] == "completed"
    assert call_json["conclusion"] == "success"


def test_update_check_run_paginates_annotations() -> None:
    """More than 50 annotations should trigger multiple PATCH requests."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.patch.return_value = mock_resp

    annotations = [
        {"path": "f.py", "start_line": i, "end_line": i, "annotation_level": "warning", "title": "t", "message": "m", "raw_details": ""}
        for i in range(75)
    ]

    with patch("app.core.github.httpx.Client", return_value=mock_client):
        update_check_run(
            installation_id=_INSTALLATION_ID,
            repo_full_name=_REPO,
            check_run_id=_CHECK_RUN_ID,
            status="completed",
            conclusion="neutral",
            title="AI Code Review",
            summary="Review done.",
            annotations=annotations,
        )

    # First PATCH (50 annotations) + second PATCH (25 remaining)
    assert mock_client.patch.call_count == 2


def test_findings_to_annotations_filters_below_threshold() -> None:
    findings = [
        {"severity": "info", "file_path": "a.py", "line_start": 1, "title": "t", "explanation": "e"},
        {"severity": "medium", "file_path": "b.py", "line_start": 5, "title": "t2", "explanation": "e2"},
    ]
    annotations = findings_to_annotations(findings, severity_threshold="medium")
    assert len(annotations) == 1
    assert annotations[0]["annotation_level"] == "warning"


def test_findings_to_annotations_skips_no_file() -> None:
    findings = [{"severity": "high", "file_path": None, "line_start": None, "title": "t", "explanation": "e"}]
    assert findings_to_annotations(findings, severity_threshold="low") == []


def test_map_verdict_critical() -> None:
    assert map_verdict_to_conclusion([{"severity": "critical"}]) == "action_required"


def test_map_verdict_medium() -> None:
    assert map_verdict_to_conclusion([{"severity": "medium"}]) == "neutral"


def test_map_verdict_no_findings() -> None:
    assert map_verdict_to_conclusion([]) == "success"
