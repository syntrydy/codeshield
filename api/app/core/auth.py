"""FastAPI dependency that decodes and validates the Supabase JWT to extract current_user_id.

Supabase projects now sign JWTs with ECC (P-256 / ES256). Verification uses the public
keys published at <supabase_url>/auth/v1/.well-known/jwks.json rather than a shared
HS256 secret. The JWKS response is cached in memory for 1 hour to avoid a round-trip
on every request.
"""

import logging
import time
from functools import lru_cache
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.algorithms import ECAlgorithm, RSAAlgorithm

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()

_JWKS_TTL = 3600  # seconds — re-fetch public keys at most once per hour


class _JwksCache:
    def __init__(self) -> None:
        self._keys: list[Any] = []
        self._fetched_at: float = 0.0

    def get_keys(self) -> list[Any]:
        if time.monotonic() - self._fetched_at > _JWKS_TTL or not self._keys:
            self._refresh()
        return self._keys

    def _refresh(self) -> None:
        url = f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json"
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
        resp.raise_for_status()
        jwks = resp.json()
        self._keys = jwks.get("keys", [])
        self._fetched_at = time.monotonic()
        logger.info("JWKS refreshed", extra={"key_count": len(self._keys)})


_jwks_cache = _JwksCache()


def _decode_token(token: str) -> dict[str, Any]:
    """Try each public key in the JWKS until one verifies the token."""
    keys = _jwks_cache.get_keys()
    if not keys:
        raise jwt.InvalidTokenError("JWKS returned no keys")

    last_exc: Exception = jwt.InvalidTokenError("No keys to try")
    for jwk in keys:
        try:
            kty = jwk.get("kty", "")
            if kty == "EC":
                public_key = ECAlgorithm.from_jwk(jwk)
                algorithms = ["ES256"]
            elif kty == "RSA":
                public_key = RSAAlgorithm.from_jwk(jwk)
                algorithms = ["RS256"]
            else:
                continue

            return jwt.decode(
                token,
                public_key,  # type: ignore[arg-type]
                algorithms=algorithms,
                audience="authenticated",
                options={"require": ["sub", "exp"]},
            )
        except jwt.ExpiredSignatureError:
            raise
        except jwt.InvalidTokenError as exc:
            last_exc = exc
            continue

    raise last_exc


def current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),  # noqa: B008
) -> str:
    """Decode the Supabase JWT and return the authenticated user's UUID.

    Raises 401 if the token is missing, expired, or has an invalid signature.
    """
    token = credentials.credentials
    try:
        payload = _decode_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id: str = payload["sub"]
    return user_id
