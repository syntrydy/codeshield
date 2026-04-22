"""Read endpoints for review runs and their findings — requires authenticated user."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.auth import current_user_id
from app.core.supabase import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["runs"])


# ── Response schemas ──────────────────────────────────────────────────────────

class RunSummary(BaseModel):
    id: UUID
    project_id: UUID
    pr_number: int
    pr_head_sha: str
    status: str
    trigger_event: str
    total_cost_usd: float
    total_input_tokens: int
    total_output_tokens: int
    created_at: str
    started_at: str | None
    completed_at: str | None


class FindingResponse(BaseModel):
    id: int
    specialist: str
    severity: str
    file_path: str | None
    line_start: int | None
    line_end: int | None
    title: str
    explanation: str
    suggested_fix: str | None
    confidence: str
    created_at: str


class RunEventResponse(BaseModel):
    id: int
    event_type: str
    payload: dict  # type: ignore[type-arg]
    created_at: str


class RunDetail(RunSummary):
    findings: list[FindingResponse]
    events: list[RunEventResponse]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/runs", response_model=list[RunSummary])
def list_runs(
    project_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(current_user_id),
) -> list[dict]:  # type: ignore[type-arg]
    """Return recent runs for a project, newest first, with cursor-style offset pagination."""
    client = get_service_client()

    # Verify project belongs to user (RLS also enforces this, but gives a clearer 404)
    proj = (
        client.table("projects")
        .select("id")
        .eq("id", str(project_id))
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if proj.data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    resp = (
        client.table("runs")
        .select("*")
        .eq("project_id", str(project_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data  # type: ignore[return-value]


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: UUID, user_id: str = Depends(current_user_id)) -> dict:  # type: ignore[type-arg]
    """Return a single run with its findings and events."""
    client = get_service_client()

    run_resp = (
        client.table("runs")
        .select("*")
        .eq("id", str(run_id))
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if run_resp.data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    findings_resp = (
        client.table("findings")
        .select("*")
        .eq("run_id", str(run_id))
        .order("severity")
        .execute()
    )

    events_resp = (
        client.table("run_events")
        .select("*")
        .eq("run_id", str(run_id))
        .order("created_at")
        .execute()
    )

    return {
        **run_resp.data,
        "findings": findings_resp.data,
        "events": events_resp.data,
    }
