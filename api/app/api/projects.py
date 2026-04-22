"""CRUD endpoints for projects (connected repositories) — requires authenticated user."""

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.core.auth import current_user_id
from app.core.supabase import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Request / response schemas ────────────────────────────────────────────────

class ProjectResponse(BaseModel):
    id: UUID
    github_repo_full_name: str
    default_branch: str
    enabled_specialists: list[str]
    severity_threshold: str
    review_output_locale: str
    created_at: str


_Specialist = Literal["security", "correctness", "performance", "style"]


class ProjectUpdateRequest(BaseModel):
    enabled_specialists: Annotated[list[_Specialist], ...] | None = None
    severity_threshold: Literal["info", "low", "medium", "high", "critical"] | None = None
    review_output_locale: Literal["en", "fr"] | None = None

    @field_validator("enabled_specialists")
    @classmethod
    def at_least_one_specialist(cls, v: list[_Specialist] | None) -> list[_Specialist] | None:
        if v is not None and len(v) == 0:
            raise ValueError("at least one specialist must remain enabled")
        return v


class UserStats(BaseModel):
    total_findings: int
    critical_findings: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectResponse])
def list_projects(user_id: str = Depends(current_user_id)) -> list[dict]:  # type: ignore[type-arg]
    """Return all projects belonging to the authenticated user."""
    client = get_service_client()
    resp = (
        client.table("projects")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data  # type: ignore[return-value]


@router.get("/stats", response_model=UserStats, summary="User stats (must be declared before /{project_id})")
def get_user_stats(user_id: str = Depends(current_user_id)) -> dict:  # type: ignore[type-arg]
    """Return aggregate finding counts across all runs owned by the authenticated user.

    NOTE: This route must remain before /{project_id} in the router so the static
    path 'stats' is never captured by the dynamic UUID parameter.
    """
    client = get_service_client()
    runs_resp = client.table("runs").select("id").eq("user_id", user_id).execute()
    run_ids = [r["id"] for r in (runs_resp.data or [])]
    if not run_ids:
        return {"total_findings": 0, "critical_findings": 0}
    total_resp = (
        client.table("findings")
        .select("id", count="exact")
        .in_("run_id", run_ids)
        .execute()
    )
    critical_resp = (
        client.table("findings")
        .select("id", count="exact")
        .in_("run_id", run_ids)
        .in_("severity", ["critical", "high"])
        .execute()
    )
    return {
        "total_findings": total_resp.count or 0,
        "critical_findings": critical_resp.count or 0,
    }


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: UUID, user_id: str = Depends(current_user_id)) -> dict:  # type: ignore[type-arg]
    """Return a single project by ID (must belong to the authenticated user)."""
    client = get_service_client()
    resp = (
        client.table("projects")
        .select("*")
        .eq("id", str(project_id))
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if resp.data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return resp.data  # type: ignore[return-value]


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    user_id: str = Depends(current_user_id),
) -> None:
    """Remove a project and all its associated runs from the database.

    This is the user-initiated disconnect path. GitHub App uninstall events
    also remove projects via the webhook handler.
    """
    client = get_service_client()
    resp = (
        client.table("projects")
        .delete()
        .eq("id", str(project_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    body: ProjectUpdateRequest,
    user_id: str = Depends(current_user_id),
) -> dict:  # type: ignore[type-arg]
    """Update specialist selection, severity threshold, or review locale for a project."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    client = get_service_client()
    resp = (
        client.table("projects")
        .update(updates)
        .eq("id", str(project_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return resp.data[0]  # type: ignore[return-value]
