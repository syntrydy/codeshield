"""ReviewState TypedDict definition — the single shared state object for the LangGraph pipeline."""

from operator import add
from typing import Annotated, Literal, TypedDict


class ReviewState(TypedDict):
    # ── Inputs (set by the Celery task before graph invocation) ──────────────
    run_id: str
    project_id: str
    pr_url: str
    pr_head_sha: str
    pr_base_sha: str
    locale: Literal["en", "fr"]
    enabled_specialists: list[str]

    # ── Planner output ────────────────────────────────────────────────────────
    plan: dict | None          # {change_type, focus_areas, skip_specialists}
    changed_files: list[str]

    # ── Specialist outputs — Annotated reducer concatenates across branches ──
    # Do NOT change these to plain list[...]; the reducer is what makes
    # parallel fan-out safe (last writer would otherwise overwrite earlier ones).
    findings: Annotated[list[dict], add]
    specialist_errors: Annotated[list[dict], add]

    # ── Aggregator output ─────────────────────────────────────────────────────
    final_review: dict | None  # {summary, findings_by_severity, verdict}
