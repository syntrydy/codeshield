"""One-time script to push prompt templates to LangSmith Hub.

Run from the api/ directory:
    uv run python scripts/seed_prompts.py

Requirements:
    LANGSMITH_API_KEY must be set in the environment or .env file.

What it does:
    Pushes each entry in FALLBACK_PROMPTS to LangSmith Hub under
    ai-reviewer/<name>, then tags the created version as `production`.

Re-running is safe — it creates a new version each time, leaving the
`production` tag pointing to the latest push.
"""

import sys

from langchain_core.prompts import ChatPromptTemplate
from langsmith import Client

# Import prompts from the app so this script is the single source of truth
sys.path.insert(0, ".")
from app.graph.prompts import FALLBACK_PROMPTS  # noqa: E402


def main() -> None:
    client = Client()

    for name, template in FALLBACK_PROMPTS.items():
        hub_name = f"ai-reviewer/{name}"
        print(f"Pushing {hub_name} ...", end=" ", flush=True)

        prompt = ChatPromptTemplate.from_messages([("system", template)])

        try:
            url = client.push_prompt(hub_name, object=prompt, tags=["production"])
            print(f"ok → {url}")
        except Exception as exc:
            print(f"FAILED: {exc}")
            sys.exit(1)

    print(f"\nDone. {len(FALLBACK_PROMPTS)} prompts pushed with tag 'production'.")
    print("Verify at: https://smith.langchain.com/hub/ai-reviewer")


if __name__ == "__main__":
    main()
