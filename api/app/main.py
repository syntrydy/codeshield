"""FastAPI application entry point — mounts user-facing API and webhook routers."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="CodeShield API", lifespan=lifespan)
    app.include_router(health_router)
    return app


app = create_app()
