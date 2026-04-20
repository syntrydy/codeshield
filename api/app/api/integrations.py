"""GitHub App installation callback endpoint (/integrations/github/install-callback)."""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.core.auth import current_user_id
from app.core.github import _make_app_jwt, get_installation_token
from app.core.supabase import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])

_DEFAULT_SPECIALISTS = ["security", "correctness", "performance", "style"]


@router.get("/github/install-callback")
def github_install_callback(
    installation_id: int = Query(...),
    setup_action: str = Query(...),
    user_id: str = Depends(current_user_id),
) -> RedirectResponse:
    """Handle the redirect from GitHub after a user installs or updates the App.

    Flow (DESIGN.md §8.3):
      1. Fetch installation details from GitHub (authenticated as the App).
      2. Upsert into github_app_installations.
      3. Fetch accessible repositories for this installation.
      4. Upsert each repo into projects with default settings.
      5. Redirect to dashboard.
    """
    client = get_service_client()

    # 1. Fetch installation metadata from GitHub
    try:
        app_jwt = _make_app_jwt()
        with httpx.Client(timeout=15.0) as http:
            install_resp = http.get(
                f"https://api.github.com/app/installations/{installation_id}",
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            install_resp.raise_for_status()
            install_data = install_resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "GitHub installation fetch failed",
            extra={"installation_id": installation_id, "status": exc.response.status_code},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch installation from GitHub",
        ) from exc

    account = install_data["account"]

    # 2. Upsert github_app_installations
    install_upsert = client.table("github_app_installations").upsert(
        {
            "user_id": user_id,
            "installation_id": installation_id,
            "account_login": account["login"],
            "account_type": account["type"],
            "suspended_at": None,
        },
        on_conflict="installation_id",
    ).execute()

    installation_row_id: str = install_upsert.data[0]["id"]

    # 3. Fetch accessible repositories
    try:
        install_token = get_installation_token(installation_id)
        with httpx.Client(timeout=15.0) as http:
            repos_resp = http.get(
                "https://api.github.com/installation/repositories",
                headers={
                    "Authorization": f"token {install_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                params={"per_page": 100},
            )
            repos_resp.raise_for_status()
            repos = repos_resp.json().get("repositories", [])
    except httpx.HTTPStatusError as exc:
        logger.error(
            "GitHub repos fetch failed",
            extra={"installation_id": installation_id, "status": exc.response.status_code},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch repositories from GitHub",
        ) from exc

    # 4. Upsert each repository as a project
    for repo in repos:
        client.table("projects").upsert(
            {
                "user_id": user_id,
                "installation_id": installation_row_id,
                "github_repo_id": repo["id"],
                "github_repo_full_name": repo["full_name"],
                "default_branch": repo.get("default_branch", "main"),
                "enabled_specialists": _DEFAULT_SPECIALISTS,
                "severity_threshold": "low",
                "review_output_locale": "en",
            },
            on_conflict="github_repo_id",
        ).execute()

    logger.info(
        "Installation callback complete",
        extra={
            "user_id": user_id,
            "installation_id": installation_id,
            "repos_upserted": len(repos),
        },
    )

    # 5. Redirect to dashboard
    return RedirectResponse(url="/dashboard?installed=1", status_code=status.HTTP_302_FOUND)
