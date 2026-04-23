"""Abstract cache client.

Uses DynamoDB when CACHE_TABLE_NAME is set (production / AWS).
Falls back to Redis for local development (docker-compose).
"""

import time
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings


@lru_cache
def _dynamo_table():  # type: ignore[return]
    settings = get_settings()
    dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return dynamodb.Table(settings.cache_table_name)


def cache_get(key: str) -> str | None:
    settings = get_settings()
    if settings.cache_table_name:
        item = _dynamo_table().get_item(Key={"pk": key}).get("Item")
        if item and int(item.get("ttl", 0)) > int(time.time()):
            return str(item["value"])
        return None
    from app.core.redis import get_redis  # local dev only
    val = get_redis().get(key)
    return val.decode() if isinstance(val, bytes) else (str(val) if val is not None else None)


def cache_set(key: str, value: str, ttl_seconds: int) -> None:
    settings = get_settings()
    if settings.cache_table_name:
        _dynamo_table().put_item(
            Item={"pk": key, "value": value, "ttl": int(time.time()) + ttl_seconds}
        )
        return
    from app.core.redis import get_redis
    get_redis().setex(key, ttl_seconds, value)


def cache_set_nx(key: str, ttl_seconds: int) -> bool:
    """Set key only if it doesn't exist or has expired. Returns True if newly set."""
    settings = get_settings()
    if settings.cache_table_name:
        try:
            _dynamo_table().put_item(
                Item={"pk": key, "ttl": int(time.time()) + ttl_seconds},
                ConditionExpression="attribute_not_exists(#pk) OR #ttl < :now",
                ExpressionAttributeNames={"#pk": "pk", "#ttl": "ttl"},
                ExpressionAttributeValues={":now": int(time.time())},
            )
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise
    from app.core.redis import get_redis
    return bool(get_redis().set(key, 1, ex=ttl_seconds, nx=True))
