"""LangSmith Hub prompt loader with in-memory cache and bundled fallbacks for outages."""

import logging
from functools import lru_cache

from langsmith import Client

logger = logging.getLogger(__name__)

# Bundled fallback prompts used when LangSmith is unreachable.
# These are intentionally minimal — real prompts live in LangSmith Hub under
# ai-reviewer/<name> and are seeded separately.
FALLBACK_PROMPTS: dict[str, str] = {
    "planner": (
        "You are a code review planner. Analyze the pull request and determine which "
        "specialist reviewers should examine it. Respond in {locale}."
    ),
    "security": (
        "You are a security specialist. Review the code changes for security vulnerabilities "
        "including injection, auth issues, secrets exposure, and input validation. "
        "Respond in {locale}."
    ),
    "correctness": (
        "You are a correctness specialist. Review the code changes for logic errors, "
        "edge cases, error handling issues, and race conditions. Respond in {locale}."
    ),
    "performance": (
        "You are a performance specialist. Review the code changes for N+1 queries, "
        "inefficient algorithms, blocking I/O, and memory issues. Respond in {locale}."
    ),
    "style": (
        "You are a style specialist. Review the code changes for naming conventions, "
        "API design, documentation quality, and consistency. Respond in {locale}."
    ),
    "aggregator": (
        "You are a review aggregator. Deduplicate and rank findings from multiple specialists, "
        "then produce a final review summary and verdict. Respond in {locale}."
    ),
}

_PROMPT_HUB_PREFIX = "ai-reviewer"


@lru_cache(maxsize=32)
def get_prompt(name: str, tag: str = "production") -> str:
    """Return the prompt template for the given specialist or orchestrator node.

    Pulls from LangSmith Hub (ai-reviewer/<name>:<tag>) on first call and caches
    for the process lifetime. Falls back to FALLBACK_PROMPTS on any error so a
    LangSmith outage does not bring down the worker.
    """
    try:
        client = Client()
        prompt = client.pull_prompt(f"{_PROMPT_HUB_PREFIX}/{name}:{tag}")
        # pull_prompt returns a runnable; extract the system message template string
        messages = prompt.messages  # type: ignore[attr-defined]
        system_message = messages[0]
        template: str = system_message.prompt.template  # type: ignore[union-attr]
        logger.info("Loaded prompt from LangSmith Hub", extra={"prompt_name": name, "tag": tag})
        return template
    except Exception as exc:
        logger.warning(
            "LangSmith prompt pull failed, using fallback",
            extra={"prompt_name": name, "tag": tag, "error": str(exc)},
        )
        return FALLBACK_PROMPTS[name]
