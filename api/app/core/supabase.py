"""Supabase client factories — publishable-key client for user-facing reads, service-role for worker writes."""

import copy
import re
from functools import lru_cache
from typing import Optional

import supabase._sync.client as _sc_mod
from supabase import Client, SupabaseException, create_client
from supabase._sync.client import SyncClient
from supabase.lib.client_options import ClientOptions, SyncMemoryStorage

from app.core.config import get_settings

# supabase-py validates API keys as JWTs, but Supabase now issues non-JWT keys
# (sb_publishable_xxx / sb_secret_xxx). Replace __init__ to accept both formats.
def _patched_init(
    self,
    supabase_url: str,
    supabase_key: str,
    options: Optional[ClientOptions] = None,
) -> None:
    if not supabase_url:
        raise SupabaseException("supabase_url is required")
    if not supabase_key:
        raise SupabaseException("supabase_key is required")
    if not re.match(r"^(https?)://.+", supabase_url):
        raise SupabaseException("Invalid URL")
    # Accept both legacy JWT keys and new sb_xxx format — skip the JWT regex.

    if options is None:
        options = ClientOptions(storage=SyncMemoryStorage())

    self.supabase_url = supabase_url
    self.supabase_key = supabase_key
    self.options = copy.deepcopy(options)
    self.options.headers.update(self._get_auth_headers())

    self.rest_url = f"{supabase_url}/rest/v1"
    self.realtime_url = f"{supabase_url}/realtime/v1".replace("http", "ws")
    self.auth_url = f"{supabase_url}/auth/v1"
    self.storage_url = f"{supabase_url}/storage/v1"
    self.functions_url = f"{supabase_url}/functions/v1"

    self.auth = self._init_supabase_auth_client(
        auth_url=self.auth_url,
        client_options=self.options,
    )
    self.realtime = self._init_realtime_client(
        realtime_url=self.realtime_url,
        supabase_key=self.supabase_key,
        options=self.options.realtime if self.options else None,
    )
    self._postgrest = None
    self._storage = None
    self._functions = None
    self.auth.on_auth_state_change(self._listen_to_auth_events)


_sc_mod.SyncClient.__init__ = _patched_init  # type: ignore[method-assign]


@lru_cache
def get_anon_client() -> Client:
    """Returns a client authenticated with the publishable key (subject to RLS)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_publishable_key)


@lru_cache
def get_service_client() -> Client:
    """Returns a client authenticated with the service-role key (bypasses RLS).

    Must only be used inside Celery workers — never passed to or called from browser-facing code.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_secret_key)
