"""FastAPI application entry point — mounts user-facing API and webhook routers."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.integrations import router as integrations_router
from app.api.projects import router as projects_router
from app.api.runs import router as runs_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.webhooks.github import router as webhook_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="CodeShield API", lifespan=lifespan)

    origins = (
        ["*"] if settings.environment == "development"
        else ["https://your-production-domain.com"]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(projects_router)
    app.include_router(runs_router)
    app.include_router(integrations_router)
    app.include_router(webhook_router, prefix="/webhooks")
    return app


app = create_app()
