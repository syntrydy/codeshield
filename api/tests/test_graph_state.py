"""Tests for ReviewState structure and the Annotated list reducers."""

import operator
from typing import get_type_hints

from app.graph.state import ReviewState


def test_all_required_keys_present() -> None:
    expected_keys = {
        "run_id", "project_id", "pr_url", "pr_head_sha", "pr_base_sha",
        "locale", "enabled_specialists", "plan", "changed_files",
        "findings", "specialist_errors", "final_review",
    }
    assert set(ReviewState.__annotations__) == expected_keys


def test_findings_has_add_reducer() -> None:
    hints = get_type_hints(ReviewState, include_extras=True)
    findings = hints["findings"]
    assert hasattr(findings, "__metadata__"), "findings must be Annotated"
    assert findings.__metadata__[0] is operator.add


def test_specialist_errors_has_add_reducer() -> None:
    hints = get_type_hints(ReviewState, include_extras=True)
    errors = hints["specialist_errors"]
    assert hasattr(errors, "__metadata__"), "specialist_errors must be Annotated"
    assert errors.__metadata__[0] is operator.add


def test_reducer_concatenates_across_branches() -> None:
    """Simulate what LangGraph does when two parallel branches return findings."""
    branch_a = [{"specialist": "security", "title": "SQLi"}]
    branch_b = [{"specialist": "style", "title": "Naming"}]
    combined = operator.add(branch_a, branch_b)
    assert len(combined) == 2
    assert combined[0]["specialist"] == "security"
    assert combined[1]["specialist"] == "style"


def test_state_construction() -> None:
    state: ReviewState = {
        "run_id": "r1", "project_id": "p1",
        "pr_url": "https://github.com/o/r/pull/1",
        "pr_head_sha": "abc", "pr_base_sha": "def",
        "locale": "en", "enabled_specialists": ["security"],
        "plan": None, "changed_files": [],
        "findings": [], "specialist_errors": [],
        "final_review": None,
    }
    assert state["locale"] == "en"
    assert state["findings"] == []
