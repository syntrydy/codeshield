"""Tests for LangChain tools in app/graph/tools.py.

All tests mock httpx at the boundary so no real GitHub calls are made.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.graph.tools import (
    ALL_TOOLS,
    get_adjacent_code,
    get_changed_files,
    get_diff,
    get_file_content,
    get_pr_metadata,
    set_github_context,
)

_FAKE_HEADERS = {"Authorization": "Bearer test-token", "Accept": "application/vnd.github+json"}


@pytest.fixture(autouse=True)
def github_context() -> None:
    set_github_context(
        installation_id=12345,
        repo_full_name="owner/repo",
        pr_head_sha="deadbeef",
    )


@pytest.fixture(autouse=True)
def mock_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Bypass Redis/GitHub App token exchange in all tool tests."""
    monkeypatch.setattr("app.graph.tools._get_headers", lambda: _FAKE_HEADERS)


def _mock_response(status_code: int = 200, json_data: object = None, text: str = "") -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.is_success = 200 <= status_code < 300
    resp.json.return_value = json_data or {}
    resp.text = text
    return resp


# ── get_pr_metadata ──────────────────────────────────────────────────────────

def test_get_pr_metadata_returns_formatted_string() -> None:
    pr_data = {
        "title": "Add login",
        "user": {"login": "alice"},
        "base": {"ref": "main", "sha": "aabbccdd"},
        "head": {"ref": "feature", "sha": "deadbeef"},
        "body": "Implements login flow",
    }
    mock_resp = _mock_response(json_data=pr_data)

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_pr_metadata.invoke({"pr_url": "https://github.com/owner/repo/pull/42"})

    assert "Add login" in result
    assert "alice" in result
    assert "main" in result


def test_get_pr_metadata_invalid_url() -> None:
    result = get_pr_metadata.invoke({"pr_url": "https://not-a-pr-url.com"})
    assert "Could not parse PR number" in result


def test_get_pr_metadata_github_error() -> None:
    mock_resp = _mock_response(status_code=404, text="Not found")

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_pr_metadata.invoke({"pr_url": "https://github.com/owner/repo/pull/99"})

    assert "GitHub API error 404" in result


# ── get_changed_files ────────────────────────────────────────────────────────

def test_get_changed_files_paginates() -> None:
    page1 = [{"filename": "src/auth.py"}, {"filename": "tests/test_auth.py"}]
    page2: list[dict] = []

    responses = [
        _mock_response(json_data=page1),
        _mock_response(json_data=page2),
    ]

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.side_effect = responses
        result = get_changed_files.invoke({"pr_url": "https://github.com/owner/repo/pull/1"})

    assert "src/auth.py" in result
    assert "tests/test_auth.py" in result


def test_get_changed_files_empty() -> None:
    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = _mock_response(json_data=[])
        result = get_changed_files.invoke({"pr_url": "https://github.com/owner/repo/pull/1"})

    assert "(no changed files)" in result


# ── get_file_content ─────────────────────────────────────────────────────────

def test_get_file_content_returns_text() -> None:
    mock_resp = _mock_response(text="def hello(): pass")

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_file_content.invoke({"path": "src/hello.py"})

    assert "def hello(): pass" in result


def test_get_file_content_truncates_large_files() -> None:
    big_content = "x" * 25_000
    mock_resp = _mock_response(text=big_content)

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_file_content.invoke({"path": "big.py"})

    assert "truncated" in result
    assert len(result) < 25_000


def test_get_file_content_404() -> None:
    mock_resp = _mock_response(status_code=404)

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_file_content.invoke({"path": "missing.py"})

    assert "File not found" in result


# ── get_diff ─────────────────────────────────────────────────────────────────

def test_get_diff_returns_diff_text() -> None:
    diff = "@@ -1,3 +1,4 @@\n+new line\n context"
    mock_resp = _mock_response(text=diff)

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_diff.invoke({"path": "src/foo.py"})

    assert "@@ -1,3 +1,4 @@" in result


def test_get_diff_no_head_sha() -> None:
    set_github_context(installation_id=1, repo_full_name="o/r", pr_head_sha="")
    result = get_diff.invoke({"path": "src/foo.py"})
    assert "No head SHA" in result
    # restore
    set_github_context(installation_id=12345, repo_full_name="owner/repo", pr_head_sha="deadbeef")


# ── get_adjacent_code ────────────────────────────────────────────────────────

def test_get_adjacent_code_returns_numbered_lines() -> None:
    file_content = "\n".join(f"line {i}" for i in range(1, 21))
    mock_resp = _mock_response(text=file_content)

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_resp
        result = get_adjacent_code.invoke({"path": "src/foo.py", "line": 10, "context_lines": 3})

    assert "|" in result
    assert "line 10" in result


# ── ALL_TOOLS ────────────────────────────────────────────────────────────────

def test_all_tools_contains_expected_tools() -> None:
    names = {t.name for t in ALL_TOOLS}
    assert "get_pr_metadata" in names
    assert "get_changed_files" in names
    assert "get_file_content" in names
    assert "get_diff" in names
    assert "get_adjacent_code" in names
