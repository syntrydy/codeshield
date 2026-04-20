"""CRUD endpoints for projects (connected repositories) — requires authenticated user."""

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import current_user_id
from app.core.supabase import get_anon_client

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


class ProjectUpdateRequest(BaseModel):
    enabled_specialists: list[Literal["security", "correctness", "performance", "style"]] | None = None
    severity_threshold: Literal["info", "low", "medium", "high", "critical"] | None = None
    review_output_locale: Literal["en", "fr"] | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectResponse])
def list_projects(user_id: str = Depends(current_user_id)) -> list[dict]:  # type: ignore[type-arg]
    """Return all projects belonging to the authenticated user."""
    client = get_anon_client()
    resp = (
        client.table("projects")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data  # type: ignore[return-value]


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: UUID, user_id: str = Depends(current_user_id)) -> dict:  # type: ignore[type-arg]
    """Return a single project by ID (must belong to the authenticated user)."""
    client = get_anon_client()
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

    client = get_anon_client()
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
