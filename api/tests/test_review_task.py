"""Tests for the run_review task function.

Mocks at the boundary: compiled_graph.invoke, get_service_client,
create_check_run, update_check_run. No real LLM calls, no real Supabase
connection, no broker required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.worker.tasks import _estimate_cost, run_review


_RUN_ID = "run-00000001"
_PROJECT_ID = "proj-00000001"
_INSTALLATION_ID = 42
_REPO = "owner/repo"
_PR_URL = "https://github.com/owner/repo/pull/1"
_PR_HEAD = "deadbeef"
_PR_BASE = "abc123"


def _make_sb_mock(severity_threshold: str = "low") -> MagicMock:
    """Return a Supabase client mock with per-table routing.

    The 'projects' table returns the given severity_threshold; all other
    tables return a generic chainable mock that succeeds silently.
    """
    generic = MagicMock()
    generic.execute.return_value = MagicMock(data=None)
    for m in ("select", "insert", "update", "eq", "maybe_single"):
        getattr(generic, m).return_value = generic

    project_chain = MagicMock()
    project_chain.execute.return_value = MagicMock(data={"severity_threshold": severity_threshold})
    for m in ("select", "eq", "maybe_single"):
        getattr(project_chain, m).return_value = project_chain

    client = MagicMock()
    client.table.side_effect = lambda name: project_chain if name == "projects" else generic
    return client


def _graph_result(
    verdict: str = "request_changes",
    findings: list | None = None,
    errors: list | None = None,
) -> dict:
    return {
        "final_review": {"verdict": verdict, "summary": "Review complete."},
        "findings": findings if findings is not None else [
            {"title": "SQL injection", "severity": "critical",
             "file_path": "api/users.py", "line_start": 5, "line_end": 5}
        ],
        "specialist_errors": errors or [],
        "total_input_tokens": 1000,
        "total_output_tokens": 200,
    }


# ── _estimate_cost ────────────────────────────────────────────────────────────

def test_estimate_cost_zero_tokens() -> None:
    assert _estimate_cost(0, 0) == 0.0


def test_estimate_cost_input_only() -> None:
    # 1M input tokens at $3/M = $3.00
    assert abs(_estimate_cost(1_000_000, 0) - 3.0) < 1e-4


def test_estimate_cost_output_only() -> None:
    # 1M output tokens at $15/M = $15.00
    assert abs(_estimate_cost(0, 1_000_000) - 15.0) < 1e-4


def test_estimate_cost_combined() -> None:
    cost = _estimate_cost(1_000_000, 1_000_000)
    assert abs(cost - 18.0) < 1e-4


# ── Happy path ────────────────────────────────────────────────────────────────

@patch("app.worker.tasks.compiled_graph")
@patch("app.core.supabase.get_service_client")
@patch("app.core.github.create_check_run", return_value=99)
@patch("app.core.github.update_check_run")
@patch("app.core.github.findings_to_annotations", return_value=[])
@patch("app.core.github.map_verdict_to_conclusion", return_value="failure")
def test_review_pr_returns_run_id_verdict_and_count(
    _mock_verdict, _mock_ann, mock_update_cr, mock_create_cr, mock_sb, mock_graph
) -> None:
    mock_sb.return_value = _make_sb_mock("medium")
    mock_graph.invoke.return_value = _graph_result()

    result = run_review(
        run_id=_RUN_ID,
        project_id=_PROJECT_ID,
        installation_id=_INSTALLATION_ID,
        repo_full_name=_REPO,
        pr_url=_PR_URL,
        pr_head_sha=_PR_HEAD,
        pr_base_sha=_PR_BASE,
        locale="en",
        enabled_specialists=["security", "correctness"],
    )

    assert result["run_id"] == _RUN_ID
    assert result["verdict"] == "request_changes"
    assert result["findings_count"] == 1


@patch("app.worker.tasks.compiled_graph")
@patch("app.core.supabase.get_service_client")
@patch("app.core.github.create_check_run", return_value=99)
@patch("app.core.github.update_check_run")
@patch("app.core.github.findings_to_annotations", return_value=[])
@patch("app.core.github.map_verdict_to_conclusion", return_value="failure")
def test_review_pr_invokes_graph_with_correct_state(
    _mock_verdict, _mock_ann, _mock_update, _mock_create, mock_sb, mock_graph
) -> None:
    mock_sb.return_value = _make_sb_mock("high")
    mock_graph.invoke.return_value = _graph_result(verdict="approve", findings=[])

    run_review(
        run_id=_RUN_ID,
        project_id=_PROJECT_ID,
        installation_id=_INSTALLATION_ID,
        repo_full_name=_REPO,
        pr_url=_PR_URL,
        pr_head_sha=_PR_HEAD,
        pr_base_sha=_PR_BASE,
        locale="fr",
        enabled_specialists=["security", "style"],
    )

    mock_graph.invoke.assert_called_once()
    state = mock_graph.invoke.call_args[0][0]
    assert state["run_id"] == _RUN_ID
    assert state["locale"] == "fr"
    assert state["severity_threshold"] == "high"
    assert state["enabled_specialists"] == ["security", "style"]
    assert state["github_installation_id"] == _INSTALLATION_ID
    assert state["repo_full_name"] == _REPO
    assert state["pr_url"] == _PR_URL


@patch("app.worker.tasks.compiled_graph")
@patch("app.core.supabase.get_service_client")
@patch("app.core.github.create_check_run", return_value=77)
@patch("app.core.github.update_check_run")
@patch("app.core.github.findings_to_annotations", return_value=[])
@patch("app.core.github.map_verdict_to_conclusion", return_value="failure")
def test_review_pr_creates_and_completes_check_run(
    _mock_verdict, _mock_ann, mock_update_cr, mock_create_cr, mock_sb, mock_graph
) -> None:
    mock_sb.return_value = _make_sb_mock()
    mock_graph.invoke.return_value = _graph_result()

    run_review(
        run_id=_RUN_ID,
        project_id=_PROJECT_ID,
        installation_id=_INSTALLATION_ID,
        repo_full_name=_REPO,
        pr_url=_PR_URL,
        pr_head_sha=_PR_HEAD,
        pr_base_sha=_PR_BASE,
        locale="en",
        enabled_specialists=["security"],
    )

    mock_create_cr.assert_called_once_with(
        installation_id=_INSTALLATION_ID,
        repo_full_name=_REPO,
        head_sha=_PR_HEAD,
        run_id=_RUN_ID,
    )
    # Last update_check_run call should mark it completed
    last_call_kwargs = mock_update_cr.call_args.kwargs
    assert last_call_kwargs["status"] == "completed"
    assert last_call_kwargs["check_run_id"] == 77


# ── Check Run creation failure is non-fatal ───────────────────────────────────

@patch("app.worker.tasks.compiled_graph")
@patch("app.core.supabase.get_service_client")
@patch("app.core.github.create_check_run", side_effect=RuntimeError("GitHub unavailable"))
@patch("app.core.github.update_check_run")
@patch("app.core.github.findings_to_annotations", return_value=[])
@patch("app.core.github.map_verdict_to_conclusion", return_value="success")
def test_review_pr_check_run_failure_is_nonfatal(
    _mock_verdict, _mock_ann, _mock_update, mock_create_cr, mock_sb, mock_graph
) -> None:
    mock_sb.return_value = _make_sb_mock()
    mock_graph.invoke.return_value = _graph_result(verdict="approve", findings=[])

    result = run_review(
        run_id=_RUN_ID,
        project_id=_PROJECT_ID,
        installation_id=_INSTALLATION_ID,
        repo_full_name=_REPO,
        pr_url=_PR_URL,
        pr_head_sha=_PR_HEAD,
        pr_base_sha=_PR_BASE,
        locale="en",
        enabled_specialists=["security"],
    )

    # Graph still ran despite Check Run creation failure
    mock_graph.invoke.assert_called_once()
    assert result["run_id"] == _RUN_ID


# ── Graph failure path ────────────────────────────────────────────────────────

@patch("app.worker.tasks.compiled_graph")
@patch("app.core.supabase.get_service_client")
@patch("app.core.github.create_check_run", return_value=88)
@patch("app.core.github.update_check_run")
@patch("app.core.github.findings_to_annotations", return_value=[])
@patch("app.core.github.map_verdict_to_conclusion", return_value="failure")
def test_review_pr_graph_failure_re_raises_and_marks_check_run_failed(
    _mock_verdict, _mock_ann, mock_update_cr, _mock_create, mock_sb, mock_graph
) -> None:
    mock_sb.return_value = _make_sb_mock()
    mock_graph.invoke.side_effect = RuntimeError("LLM timeout")

    with pytest.raises(RuntimeError, match="LLM timeout"):
        run_review(
            run_id=_RUN_ID,
            project_id=_PROJECT_ID,
            installation_id=_INSTALLATION_ID,
            repo_full_name=_REPO,
            pr_url=_PR_URL,
            pr_head_sha=_PR_HEAD,
            pr_base_sha=_PR_BASE,
            locale="en",
            enabled_specialists=["security"],
        )

    # Check Run must be marked as failed (conclusion="failure")
    mock_update_cr.assert_called_with(
        installation_id=_INSTALLATION_ID,
        repo_full_name=_REPO,
        check_run_id=88,
        status="completed",
        conclusion="failure",
        title="AI Code Review",
        summary="Review failed: LLM timeout",
    )


@patch("app.worker.tasks.compiled_graph")
@patch("app.core.supabase.get_service_client")
@patch("app.core.github.create_check_run", return_value=None)
@patch("app.core.github.update_check_run")
@patch("app.core.github.findings_to_annotations", return_value=[])
@patch("app.core.github.map_verdict_to_conclusion", return_value="failure")
def test_review_pr_no_installation_skips_check_run(
    _mock_verdict, _mock_ann, _mock_update, mock_create_cr, mock_sb, mock_graph
) -> None:
    mock_sb.return_value = _make_sb_mock()
    mock_graph.invoke.return_value = _graph_result()

    result = run_review(
        run_id=_RUN_ID,
        project_id=_PROJECT_ID,
        installation_id=None,
        repo_full_name=_REPO,
        pr_url=_PR_URL,
        pr_head_sha=_PR_HEAD,
        pr_base_sha=_PR_BASE,
        locale="en",
        enabled_specialists=["security"],
    )

    mock_create_cr.assert_not_called()
    assert result["run_id"] == _RUN_ID
