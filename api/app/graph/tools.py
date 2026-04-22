"""Shared LangChain tools available to all specialist agents.

Each tool is a plain function decorated with @tool.  The tools authenticate
to GitHub using the installation token cached in Redis — they extract
`installation_id` and `repo_full_name` from the run context passed in via
a thread-local / contextvars approach so each tool call uses the correct
credentials without requiring callers to thread them explicitly.

Context is set via `set_github_context()` before the graph is invoked and
read by `_get_headers()` inside each tool.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from urllib.parse import urlparse

import httpx
from langchain_core.tools import tool

from app.core.github import get_installation_token

logger = logging.getLogger(__name__)

# ── Run-level context ─────────────────────────────────────────────────────────
# Set once per Celery task before graph invocation; read by every tool call.

_installation_id_var: ContextVar[int | None] = ContextVar("installation_id", default=None)
_repo_full_name_var: ContextVar[str] = ContextVar("repo_full_name", default="")
_pr_head_sha_var: ContextVar[str] = ContextVar("pr_head_sha", default="")


def set_github_context(
    *,
    installation_id: int | None,
    repo_full_name: str,
    pr_head_sha: str,
) -> None:
    """Call this before invoking the graph so tools can authenticate."""
    _installation_id_var.set(installation_id)
    _repo_full_name_var.set(repo_full_name)
    _pr_head_sha_var.set(pr_head_sha)


def _get_headers() -> dict[str, str]:
    installation_id = _installation_id_var.get()
    if not installation_id:
        return {}
    token = get_installation_token(installation_id)
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _repo() -> str:
    return _repo_full_name_var.get()


def _head_sha() -> str:
    return _pr_head_sha_var.get()


def _pr_number_from_url(pr_url: str) -> int | None:
    """Extract the PR number from a GitHub PR URL."""
    try:
        return int(urlparse(pr_url).path.rstrip("/").split("/")[-1])
    except (ValueError, IndexError):
        return None


# ── Tools ─────────────────────────────────────────────────────────────────────

@tool
def get_pr_metadata(pr_url: str) -> str:
    """Fetch pull request title, description, and base/head info from GitHub.

    Args:
        pr_url: Full GitHub PR URL, e.g. https://github.com/owner/repo/pull/42
    """
    pr_number = _pr_number_from_url(pr_url)
    if not pr_number:
        return f"Could not parse PR number from URL: {pr_url}"

    with httpx.Client(timeout=15.0) as client:
        resp = client.get(
            f"https://api.github.com/repos/{_repo()}/pulls/{pr_number}",
            headers=_get_headers(),
        )
    if not resp.is_success:
        return f"GitHub API error {resp.status_code}: {resp.text[:200]}"

    data = resp.json()
    return (
        f"Title: {data['title']}\n"
        f"Author: {data['user']['login']}\n"
        f"Base: {data['base']['ref']} ({data['base']['sha'][:8]})\n"
        f"Head: {data['head']['ref']} ({data['head']['sha'][:8]})\n"
        f"Description:\n{data.get('body') or '(no description)'}"
    )


@tool
def get_changed_files(pr_url: str) -> str:
    """Return the list of files changed in a pull request.

    Args:
        pr_url: Full GitHub PR URL
    """
    pr_number = _pr_number_from_url(pr_url)
    if not pr_number:
        return f"Could not parse PR number from URL: {pr_url}"

    files: list[str] = []
    page = 1
    with httpx.Client(timeout=15.0) as client:
        while True:
            resp = client.get(
                f"https://api.github.com/repos/{_repo()}/pulls/{pr_number}/files",
                headers=_get_headers(),
                params={"per_page": 100, "page": page},
            )
            if not resp.is_success:
                return f"GitHub API error {resp.status_code}: {resp.text[:200]}"
            batch = resp.json()
            if not batch:
                break
            files.extend(f["filename"] for f in batch)
            page += 1

    return "\n".join(files) if files else "(no changed files)"


@tool
def get_file_content(path: str) -> str:
    """Fetch the full content of a file at the PR head commit.

    Args:
        path: File path relative to the repo root, e.g. src/auth/login.py
    """
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(
            f"https://api.github.com/repos/{_repo()}/contents/{path}",
            headers={**_get_headers(), "Accept": "application/vnd.github.raw+json"},
            params={"ref": _head_sha()},
        )
    if resp.status_code == 404:
        return f"File not found: {path}"
    if not resp.is_success:
        return f"GitHub API error {resp.status_code}: {resp.text[:200]}"

    content = resp.text
    if len(content) > 6_000:
        content = content[:6_000] + f"\n\n... (truncated — file is {len(resp.text)} chars)"
    return content


@tool
def get_diff(path: str) -> str:
    """Fetch the unified diff for a single file in the pull request.

    Args:
        path: File path relative to the repo root
    """
    # We need the diff for a specific file — fetch via contents API with diff accept header.
    head = _head_sha()
    if not head:
        return "No head SHA in context — cannot fetch diff"

    with httpx.Client(timeout=15.0) as client:
        resp = client.get(
            f"https://api.github.com/repos/{_repo()}/contents/{path}",
            headers={**_get_headers(), "Accept": "application/vnd.github.diff"},
            params={"ref": head},
        )
    if resp.status_code == 404:
        return f"File not found: {path}"
    if not resp.is_success:
        return f"GitHub API error {resp.status_code}: {resp.text[:200]}"

    diff = resp.text
    if len(diff) > 4_000:
        diff = diff[:4_000] + "\n\n... (truncated)"
    return diff if diff.strip() else "(empty diff)"


@tool
def get_adjacent_code(path: str, line: int, context_lines: int = 10) -> str:
    """Fetch N lines of context around a specific line number in a file.

    Useful when a finding points to a line and you need to understand the
    surrounding code before deciding whether to report it.

    Args:
        path: File path relative to the repo root
        line: The 1-indexed line number to centre on
        context_lines: Number of lines to show before and after (default 10)
    """
    content: str = get_file_content.invoke({"path": path})
    if content.startswith("File not found") or content.startswith("GitHub API error"):
        return content

    lines = content.splitlines()
    start = max(0, line - context_lines - 1)
    end = min(len(lines), line + context_lines)
    numbered = [f"{i + 1:4d} | {ln}" for i, ln in enumerate(lines[start:end], start=start)]
    return "\n".join(numbered)


# Convenience list for binding to a ChatModel
ALL_TOOLS = [get_pr_metadata, get_changed_files, get_file_content, get_diff, get_adjacent_code]
