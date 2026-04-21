"""Test configuration: set required env vars before any app module is imported."""

import os

# These must be set before pydantic-settings constructs Settings().
# Tests that need a specific value (e.g. jwt secret) override via monkeypatch.setattr.
_TEST_ENV = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_PUBLISHABLE_KEY": "test-publishable-key",
    "SUPABASE_SECRET_KEY": "test-secret-key",
    "SUPABASE_JWT_SECRET": "test-jwt-secret",
    "GITHUB_APP_ID": "12345",
    "GITHUB_APP_SLUG": "test-app",
    "GITHUB_WEBHOOK_SECRET": "test-webhook-secret",
    "ANTHROPIC_API_KEY": "test-anthropic-key",
    "LANGSMITH_API_KEY": "test-langsmith-key",
}

for key, value in _TEST_ENV.items():
    os.environ.setdefault(key, value)
