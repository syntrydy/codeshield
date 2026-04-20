"""LangGraph node implementations: planner, specialist wrapper, aggregator."""

import logging
from collections.abc import Callable
from typing import Any

from app.graph.state import ReviewState

logger = logging.getLogger(__name__)


def planner_node(state: ReviewState) -> dict[str, Any]:
    """Fetch PR context, classify the change, and emit a Send per enabled specialist.

    Stub implementation — real LLM call added in Day 4 (graph implementation session).
    Returns a Send for each enabled specialist so the graph can fan out in parallel.
    """
    logger.info("Planner started", extra={"run_id": state["run_id"]})

    # Stub: pass all enabled specialists through with no file focus
    plan: dict[str, Any] = {
        "change_type": "unknown",
        "focus_areas": [],
        "skip_specialists": [],
    }

    return {"plan": plan, "changed_files": []}


def safe_specialist(specialist_name: str) -> Callable[[ReviewState], dict[str, Any]]:
    """Return a node function that runs the named specialist with full error isolation.

    If the specialist raises for any reason the node:
      (a) logs the error,
      (b) emits a specialist_errors entry so the aggregator knows what failed,
      (c) returns an empty findings list so the aggregator keeps working.

    One specialist failing must never kill the whole run.
    """

    def node(state: ReviewState) -> dict[str, Any]:
        logger.info(
            "Specialist started",
            extra={"run_id": state["run_id"], "specialist": specialist_name},
        )
        try:
            return _run_specialist(specialist_name, state)
        except Exception as exc:
            logger.error(
                "Specialist failed",
                extra={
                    "run_id": state["run_id"],
                    "specialist": specialist_name,
                    "error": str(exc),
                },
            )
            return {
                "specialist_errors": [{"specialist": specialist_name, "error": str(exc)}],
                "findings": [],
            }

    node.__name__ = f"specialist_{specialist_name}"
    return node


def _run_specialist(specialist_name: str, state: ReviewState) -> dict[str, Any]:
    """Execute one specialist's ReAct loop against the PR.

    Stub implementation — real LLM + tool loop added in Day 4.
    Token accumulators are returned even from the stub so the reducer sums them correctly
    across parallel branches.
    """
    logger.info(
        "Specialist completed (stub — no findings yet)",
        extra={"run_id": state["run_id"], "specialist": specialist_name},
    )
    return {
        "findings": [],
        "specialist_errors": [],
        "total_input_tokens": 0,
        "total_output_tokens": 0,
    }


def aggregator_node(state: ReviewState) -> dict[str, Any]:
    """Deduplicate and rank findings from all specialists; produce the final review.

    Stub implementation — real LLM call added in Day 4.
    """
    logger.info(
        "Aggregator started",
        extra={"run_id": state["run_id"], "findings_count": len(state["findings"])},
    )

    final_review: dict[str, Any] = {
        "summary": "Review complete (stub).",
        "verdict": "approve",
        "findings_by_severity": {},
        "total_findings": len(state["findings"]),
    }

    return {"final_review": final_review}
