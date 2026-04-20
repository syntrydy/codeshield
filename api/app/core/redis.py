"""Redis client singleton used for idempotency keys, token cache, and debounce state."""

from functools import lru_cache

import redis as redis_lib

from app.core.config import get_settings


@lru_cache
def get_redis() -> redis_lib.Redis:  # type: ignore[type-arg]
    settings = get_settings()
    return redis_lib.Redis.from_url(
        str(settings.redis_url),
        decode_responses=True,
    )
