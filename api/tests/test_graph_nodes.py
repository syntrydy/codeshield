"""Tests for planner_node, _run_specialist, and aggregator_node.

All LLM calls are replaced with FakeListChatModel so no real Anthropic API calls are made.
GitHub tools are patched at the boundary to return canned strings.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graph.nodes import aggregator_node, planner_node, _run_specialist
from app.graph.state import ReviewState

_BASE_STATE: ReviewState = {
    "run_id": "r1",
    "project_id": "p1",
    "pr_url": "https://github.com/owner/repo/pull/1",
    "pr_head_sha": "deadbeef",
    "pr_base_sha": "abc123",
    "locale": "en",
    "enabled_specialists": ["security", "correctness"],
    "plan": None,
    "changed_files": [],
    "findings": [],
    "specialist_errors": [],
    "final_review": None,
    "total_input_tokens": 0,
    "total_output_tokens": 0,
    "github_installation_id": None,
    "repo_full_name": "owner/repo",
    "severity_threshold": "low",
}


# ── planner_node ─────────────────────────────────────────────────────────────

def _planner_state() -> ReviewState:
    return dict(_BASE_STATE)  # type: ignore[return-value]


def test_planner_returns_plan_and_changed_files() -> None:
    plan_json = json.dumps({
        "change_type": "feature",
        "focus_areas": ["src/auth/"],
        "skip_specialists": [],
        "changed_files": ["src/auth/login.py"],
    })
    fake_llm = FakeListChatModel(responses=[plan_json])

    mock_pr = MagicMock(return_value="PR meta")
    mock_files = MagicMock(return_value="src/auth/login.py")
    with (
        patch("app.graph.nodes._sonnet", return_value=fake_llm),
        patch("app.graph.tools._get_headers", return_value={}),
        patch("app.graph.tools.get_pr_metadata", mock_pr),
        patch("app.graph.tools.get_changed_files", mock_files),
    ):
        result = planner_node(_planner_state())

    assert result["plan"]["change_type"] == "feature"
    assert "src/auth/login.py" in result["changed_files"]


def test_planner_fallback_on_bad_json() -> None:
    fake_llm = FakeListChatModel(responses=["this is not json"])
    mock_pr = MagicMock(return_value="PR meta")
    mock_files = MagicMock(return_value="")

    with (
        patch("app.graph.nodes._sonnet", return_value=fake_llm),
        patch("app.graph.tools._get_headers", return_value={}),
        patch("app.graph.tools.get_pr_metadata", mock_pr),
        patch("app.graph.tools.get_changed_files", mock_files),
    ):
        result = planner_node(_planner_state())

    assert result["plan"]["change_type"] == "unknown"
    assert result["changed_files"] == []


def test_planner_includes_token_counts() -> None:
    plan_json = json.dumps({"change_type": "bugfix", "focus_areas": [], "skip_specialists": [], "changed_files": []})
    fake_llm = FakeListChatModel(responses=[plan_json])
    mock_pr = MagicMock(return_value="")
    mock_files = MagicMock(return_value="")

    with (
        patch("app.graph.nodes._sonnet", return_value=fake_llm),
        patch("app.graph.tools._get_headers", return_value={}),
        patch("app.graph.tools.get_pr_metadata", mock_pr),
        patch("app.graph.tools.get_changed_files", mock_files),
    ):
        result = planner_node(_planner_state())

    assert "total_input_tokens" in result
    assert "total_output_tokens" in result


# ── _run_specialist ──────────────────────────────────────────────────────────

def _specialist_state() -> ReviewState:
    state = dict(_BASE_STATE)  # type: ignore[assignment]
    state["plan"] = {"change_type": "feature", "focus_areas": [], "skip_specialists": []}
    state["changed_files"] = ["src/auth/login.py"]
    return state  # type: ignore[return-value]


def _fake_sonnet_with_tools(responses: list[str]) -> MagicMock:
    """Return a mock that acts like ChatAnthropic(...).bind_tools(...), returning fake responses."""
    fake_llm = FakeListChatModel(responses=responses)
    mock = MagicMock()
    mock.bind_tools.return_value = fake_llm
    mock.invoke.side_effect = fake_llm.invoke
    return mock


def test_specialist_returns_findings_list() -> None:
    findings_json = json.dumps([{
        "specialist": "security",
        "severity": "high",
        "file_path": "src/auth/login.py",
        "line_start": 10,
        "line_end": 12,
        "title": "SQL injection",
        "explanation": "User input concatenated into query",
        "suggested_fix": "Use parameterized queries",
        "confidence": "high",
    }])

    with patch("app.graph.nodes._sonnet", return_value=_fake_sonnet_with_tools([findings_json])):
        result = _run_specialist("security", _specialist_state())

    assert len(result["findings"]) == 1
    assert result["findings"][0]["title"] == "SQL injection"


def test_specialist_empty_findings_on_no_issues() -> None:
    with patch("app.graph.nodes._sonnet", return_value=_fake_sonnet_with_tools(["[]"])):
        result = _run_specialist("style", _specialist_state())

    assert result["findings"] == []
    assert result["specialist_errors"] == []


def test_specialist_stamps_specialist_name() -> None:
    findings_json = json.dumps([{"title": "Issue", "severity": "low"}])

    with patch("app.graph.nodes._sonnet", return_value=_fake_sonnet_with_tools([findings_json])):
        result = _run_specialist("performance", _specialist_state())

    assert result["findings"][0]["specialist"] == "performance"


def test_specialist_recovers_from_bad_json_output() -> None:
    with patch("app.graph.nodes._sonnet", return_value=_fake_sonnet_with_tools(["Not a JSON array, just prose."])):
        result = _run_specialist("correctness", _specialist_state())

    assert result["findings"] == []
    assert result["specialist_errors"] == []


# ── aggregator_node ──────────────────────────────────────────────────────────

def _aggregator_state() -> ReviewState:
    state = dict(_BASE_STATE)  # type: ignore[assignment]
    state["plan"] = {"change_type": "feature", "focus_areas": [], "skip_specialists": []}
    state["findings"] = [
        {"specialist": "security", "severity": "high", "title": "SQLi", "file_path": "a.py",
         "line_start": 5, "line_end": 5, "explanation": "...", "confidence": "high"},
    ]
    return state  # type: ignore[return-value]


def test_aggregator_returns_verdict() -> None:
    agg_json = json.dumps({
        "summary": "One high-severity finding.",
        "verdict": "request_changes",
        "findings": _aggregator_state()["findings"],
    })
    fake_llm = FakeListChatModel(responses=[agg_json])

    with patch("app.graph.nodes._sonnet", return_value=fake_llm):
        result = aggregator_node(_aggregator_state())

    assert result["final_review"]["verdict"] == "request_changes"
    assert "summary" in result["final_review"]


def test_aggregator_fallback_on_bad_json() -> None:
    fake_llm = FakeListChatModel(responses=["oops not json"])

    with patch("app.graph.nodes._sonnet", return_value=fake_llm):
        result = aggregator_node(_aggregator_state())

    assert result["final_review"]["verdict"] == "comment"
    assert result["final_review"]["findings"] == _aggregator_state()["findings"]


def test_aggregator_includes_token_counts() -> None:
    agg_json = json.dumps({"summary": "", "verdict": "approve", "findings": []})
    fake_llm = FakeListChatModel(responses=[agg_json])

    with patch("app.graph.nodes._sonnet", return_value=fake_llm):
        result = aggregator_node(_aggregator_state())

    assert "total_input_tokens" in result
    assert "total_output_tokens" in result
