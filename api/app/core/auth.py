"""FastAPI dependency that decodes and validates the Supabase JWT to extract current_user_id."""

import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()


def current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),  # noqa: B008
) -> str:
    """Decode the Supabase JWT and return the authenticated user's UUID.

    Raises 401 if the token is missing, expired, or has an invalid signature.
    """
    token = credentials.credentials
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id: str = payload["sub"]
    return user_id
