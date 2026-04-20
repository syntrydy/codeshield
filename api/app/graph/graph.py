"""LangGraph graph assembly: wires planner → fan-out specialists → aggregator."""

from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from app.graph.nodes import aggregator_node, planner_node, safe_specialist
from app.graph.state import ReviewState

_SPECIALISTS = ["security", "correctness", "performance", "style"]


def _route_to_specialists(state: ReviewState) -> list[Send]:
    """Conditional edge: emit one Send per enabled specialist after the planner runs."""
    plan = state.get("plan") or {}
    skip = plan.get("skip_specialists", [])
    return [
        Send(f"specialist_{s}", state)
        for s in state["enabled_specialists"]
        if s not in skip and s in _SPECIALISTS
    ]


def _build_graph() -> Any:
    builder: StateGraph = StateGraph(ReviewState)

    # Nodes
    builder.add_node("planner", planner_node)
    builder.add_node("aggregator", aggregator_node)

    # One specialist node handles all specialist names; routing via _specialist key
    for specialist in _SPECIALISTS:
        builder.add_node(f"specialist_{specialist}", safe_specialist(specialist))

    # Edges
    builder.add_edge(START, "planner")
    builder.add_conditional_edges("planner", _route_to_specialists)
    for specialist in _SPECIALISTS:
        builder.add_edge(f"specialist_{specialist}", "aggregator")
    builder.add_edge("aggregator", END)

    return builder.compile()


# Compiled at import time; workers call compiled_graph.invoke(state)
compiled_graph = _build_graph()
