"""Application settings loaded from environment variables via pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str

    # GitHub App
    github_app_id: int
    github_app_slug: str
    github_webhook_secret: str
    # Path to .pem file for local dev; in production the key is fetched from Secrets Manager.
    github_private_key_path: str | None = None
    # Raw PEM string injected at runtime (populated by the Secrets Manager loader in production).
    github_private_key: str | None = None

    # Anthropic
    anthropic_api_key: str
    # OpenAI — optional, used as fallback when Anthropic returns 429
    openai_api_key: str | None = None

    # LangSmith
    langsmith_api_key: str
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_project: str = "code-review-dev"
    langchain_tracing_v2: bool = True

    # Cache: DynamoDB table name in production, Redis URL for local dev
    cache_table_name: str | None = None
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")  # type: ignore[assignment]

    # API service
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: Literal["development", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: list[str] = ["http://localhost:5173"]

    # AWS
    aws_region: str = "us-east-1"
    s3_artifacts_bucket: str = "code-review-artifacts-dev"
    task_backend: Literal["local", "sqs"] = "local"
    sqs_queue_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
