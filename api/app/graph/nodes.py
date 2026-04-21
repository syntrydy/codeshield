"""LangGraph node implementations: planner, specialist wrapper, aggregator."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from app.core.config import get_settings
from app.graph.prompts import get_prompt
from app.graph.state import ReviewState
from app.graph.tools import ALL_TOOLS, set_github_context

logger = logging.getLogger(__name__)

_MAX_TOOL_ITERATIONS = 6


def _sonnet() -> ChatAnthropic:
    from pydantic import SecretStr
    return ChatAnthropic(  # type: ignore[call-arg]
        model="claude-sonnet-4-5",
        api_key=SecretStr(get_settings().anthropic_api_key),
        max_tokens=4096,
    )


def _extract_json(text: str) -> Any:
    """Extract the first JSON object or array from a string."""
    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if match:
        return json.loads(match.group(1))
    return json.loads(text)


def planner_node(state: ReviewState) -> dict[str, Any]:
    """Call Claude Sonnet with the planner prompt to classify the PR and list changed files.

    Returns the parsed plan dict and changed_files list so specialist nodes can focus
    their reviews. On parse failure, falls back to a safe default so the run continues.
    """
    logger.info("Planner started", extra={"run_id": state["run_id"]})

    set_github_context(
        installation_id=state["github_installation_id"],
        repo_full_name=state["repo_full_name"],
        pr_head_sha=state["pr_head_sha"],
    )

    from app.graph.tools import get_changed_files, get_pr_metadata  # local to avoid import cycle

    pr_meta = get_pr_metadata.invoke({"pr_url": state["pr_url"]})
    changed = get_changed_files.invoke({"pr_url": state["pr_url"]})

    system = get_prompt("planner").format(locale=state["locale"])
    user_msg = f"PR metadata:\n{pr_meta}\n\nChanged files:\n{changed}"

    llm = _sonnet()
    ai_resp: AIMessage = llm.invoke([SystemMessage(content=system), HumanMessage(content=user_msg)])  # type: ignore[assignment]

    meta: dict[str, Any] = ai_resp.usage_metadata or {}  # type: ignore[assignment]
    input_tokens: int = meta.get("input_tokens", 0)
    output_tokens: int = meta.get("output_tokens", 0)

    try:
        parsed = _extract_json(str(ai_resp.content))
        plan = {
            "change_type": parsed.get("change_type", "unknown"),
            "focus_areas": parsed.get("focus_areas", []),
            "skip_specialists": parsed.get("skip_specialists", []),
        }
        changed_files: list[str] = parsed.get("changed_files", [])
    except (json.JSONDecodeError, AttributeError, TypeError) as exc:
        logger.warning("Planner JSON parse failed, using defaults", extra={"error": str(exc)})
        plan = {"change_type": "unknown", "focus_areas": [], "skip_specialists": []}
        changed_files = []

    logger.info("Planner complete", extra={"run_id": state["run_id"], "plan": plan})
    return {
        "plan": plan,
        "changed_files": changed_files,
        "total_input_tokens": input_tokens,
        "total_output_tokens": output_tokens,
    }


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
                "total_input_tokens": 0,
                "total_output_tokens": 0,
            }

    node.__name__ = f"specialist_{specialist_name}"
    return node


def _run_specialist(specialist_name: str, state: ReviewState) -> dict[str, Any]:
    """Execute one specialist's ReAct loop (up to _MAX_TOOL_ITERATIONS tool rounds).

    The specialist is given its system prompt and the plan context. It may call any tool
    from ALL_TOOLS to inspect the PR. After the loop, the final AI message is parsed for
    a JSON array of findings.
    """
    set_github_context(
        installation_id=state["github_installation_id"],
        repo_full_name=state["repo_full_name"],
        pr_head_sha=state["pr_head_sha"],
    )

    system_template = get_prompt(specialist_name)
    system = system_template.format(
        plan=json.dumps(state["plan"]),
        changed_files="\n".join(state["changed_files"]),
        severity_threshold=state["severity_threshold"],
        locale=state["locale"],
    )

    llm = _sonnet().bind_tools(ALL_TOOLS)

    messages: list[Any] = [
        SystemMessage(content=system),
        HumanMessage(content=f"PR URL: {state['pr_url']}\n\nBegin your review."),
    ]

    total_in = 0
    total_out = 0

    for _ in range(_MAX_TOOL_ITERATIONS):
        response: AIMessage = llm.invoke(messages)  # type: ignore[assignment]
        if response.usage_metadata:
            total_in += response.usage_metadata.get("input_tokens", 0)
            total_out += response.usage_metadata.get("output_tokens", 0)

        messages.append(response)

        if not response.tool_calls:
            break

        for tc in response.tool_calls:
            tool_map = {t.name: t for t in ALL_TOOLS}
            tool = tool_map.get(tc["name"])
            result = f"Unknown tool: {tc['name']}" if tool is None else str(tool.invoke(tc["args"]))
            messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))

    # Parse findings from the last AI message
    last_content = str(response.content) if response.content else "[]"
    try:
        findings = _extract_json(last_content)
        if not isinstance(findings, list):
            findings = []
    except (json.JSONDecodeError, TypeError):
        findings = []

    # Stamp specialist name on each finding in case the model omitted it
    for f in findings:
        f.setdefault("specialist", specialist_name)

    logger.info(
        "Specialist complete",
        extra={
            "run_id": state["run_id"],
            "specialist": specialist_name,
            "findings_count": len(findings),
        },
    )
    return {
        "findings": findings,
        "specialist_errors": [],
        "total_input_tokens": total_in,
        "total_output_tokens": total_out,
    }


def aggregator_node(state: ReviewState) -> dict[str, Any]:
    """Call Claude Sonnet with the aggregator prompt to deduplicate, rank, and summarise findings.

    Produces the final review object with verdict, summary, and cleaned finding list.
    """
    logger.info(
        "Aggregator started",
        extra={"run_id": state["run_id"], "findings_count": len(state["findings"])},
    )

    system_template = get_prompt("aggregator")
    system = system_template.format(
        findings=json.dumps(state["findings"]),
        plan=json.dumps(state["plan"]),
        locale=state["locale"],
    )

    llm = _sonnet()
    agg_resp: AIMessage = llm.invoke([SystemMessage(content=system), HumanMessage(content="Produce the final review.")])  # type: ignore[assignment]

    agg_meta: dict[str, Any] = agg_resp.usage_metadata or {}  # type: ignore[assignment]
    input_tokens: int = agg_meta.get("input_tokens", 0)
    output_tokens: int = agg_meta.get("output_tokens", 0)

    try:
        parsed = _extract_json(str(agg_resp.content))
        final_review: dict[str, Any] = {
            "summary": parsed.get("summary", ""),
            "verdict": parsed.get("verdict", "comment"),
            "findings": parsed.get("findings", state["findings"]),
        }
    except (json.JSONDecodeError, AttributeError, TypeError) as exc:
        logger.warning("Aggregator JSON parse failed, using raw findings", extra={"error": str(exc)})
        final_review = {
            "summary": "Review complete.",
            "verdict": "comment",
            "findings": state["findings"],
        }

    logger.info(
        "Aggregator complete",
        extra={"run_id": state["run_id"], "verdict": final_review["verdict"]},
    )
    return {
        "final_review": final_review,
        "total_input_tokens": input_tokens,
        "total_output_tokens": output_tokens,
    }
