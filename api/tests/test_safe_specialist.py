"""Tests for the safe_specialist error-isolation wrapper (DESIGN.md §6.6)."""

from unittest.mock import patch

from app.graph.nodes import safe_specialist
from app.graph.state import ReviewState

_BASE_STATE: ReviewState = {
    "run_id": "r1", "project_id": "p1",
    "pr_url": "https://github.com/o/r/pull/1",
    "pr_head_sha": "abc", "pr_base_sha": "def",
    "locale": "en", "enabled_specialists": ["security"],
    "plan": None, "changed_files": [],
    "findings": [], "specialist_errors": [],
    "final_review": None,
    "total_input_tokens": 0, "total_output_tokens": 0,
    "github_installation_id": None, "repo_full_name": "owner/repo",
    "severity_threshold": "low",
}


def test_happy_path_returns_findings_key() -> None:
    stub = {"findings": [], "specialist_errors": [], "total_input_tokens": 0, "total_output_tokens": 0}
    with patch("app.graph.nodes._run_specialist", return_value=stub):
        node = safe_specialist("security")
        result = node(_BASE_STATE)
    assert "findings" in result
    assert isinstance(result["findings"], list)


def test_happy_path_returns_no_errors() -> None:
    stub = {"findings": [], "specialist_errors": [], "total_input_tokens": 0, "total_output_tokens": 0}
    with patch("app.graph.nodes._run_specialist", return_value=stub):
        node = safe_specialist("security")
        result = node(_BASE_STATE)
    assert result.get("specialist_errors", []) == []


def test_exception_is_captured_not_raised() -> None:
    """A crashing specialist must not propagate — the aggregator must still run."""
    with patch("app.graph.nodes._run_specialist", side_effect=RuntimeError("LLM timeout")):
        node = safe_specialist("correctness")
        result = node(_BASE_STATE)  # must not raise

    assert result["findings"] == []
    assert len(result["specialist_errors"]) == 1


def test_error_entry_contains_specialist_name() -> None:
    with patch("app.graph.nodes._run_specialist", side_effect=ValueError("rate limit")):
        node = safe_specialist("performance")
        result = node(_BASE_STATE)

    assert result["specialist_errors"][0]["specialist"] == "performance"


def test_error_entry_contains_error_message() -> None:
    with patch("app.graph.nodes._run_specialist", side_effect=ValueError("rate limit")):
        node = safe_specialist("performance")
        result = node(_BASE_STATE)

    assert "rate limit" in result["specialist_errors"][0]["error"]


def test_node_name_matches_specialist() -> None:
    node = safe_specialist("style")
    assert node.__name__ == "specialist_style"


def test_different_specialists_are_independent() -> None:
    """Two safe_specialist nodes wrapping different names must not share state."""
    sec_node = safe_specialist("security")
    sty_node = safe_specialist("style")
    assert sec_node.__name__ != sty_node.__name__
