"""Celery application factory configured with Redis broker and result backend."""

from celery import Celery

from app.core.config import get_settings


def create_celery_app() -> Celery:
    settings = get_settings()
    redis_url = str(settings.redis_url)

    app = Celery(
        "codeshield",
        broker=redis_url,
        backend=redis_url,
        include=["app.worker.tasks"],
    )

    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        # Hard cap per run: 5 minutes (DESIGN.md §14.2)
        task_time_limit=300,
        task_soft_time_limit=270,
        # One task per run — no chains or chords (CLAUDE.md)
        task_acks_late=True,
        worker_prefetch_multiplier=1,
    )

    return app


celery_app = create_celery_app()
