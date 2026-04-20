"""Supabase client factories — anon client for user-facing reads, service-role for worker writes."""

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_anon_client() -> Client:
    """Returns a client authenticated with the anon key (subject to RLS)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_service_client() -> Client:
    """Returns a client authenticated with the service-role key (bypasses RLS).

    Must only be used inside Celery workers — never passed to or called from browser-facing code.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
