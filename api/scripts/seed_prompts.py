"""Push prompt templates to LangSmith as private workspace prompts.

Run from the api/ directory:
    uv run python scripts/seed_prompts.py

Requirements:
    LANGSMITH_API_KEY and LANGSMITH_ENDPOINT must be set in .env.

What it does:
    Pushes each entry in FALLBACK_PROMPTS to your LangSmith workspace under
    codeshield-<name> with the `production` tag.  No owner prefix needed —
    these are private workspace prompts, not public Hub entries.

Re-running is safe: creates a new version each time, `production` tag
always points to the latest push.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langsmith import Client

_REPO_ROOT = Path(__file__).parent.parent.parent
load_dotenv(_REPO_ROOT / ".env")

sys.path.insert(0, ".")
from app.graph.prompts import FALLBACK_PROMPTS  # noqa: E402


def main() -> None:
    api_key = os.environ.get("LANGSMITH_API_KEY")
    endpoint = os.environ.get("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")

    if not api_key:
        print("ERROR: LANGSMITH_API_KEY not found in .env")
        sys.exit(1)

    client = Client(api_key=api_key, api_url=endpoint)
    print(f"Endpoint : {endpoint}")
    print(f"Prompts  : {len(FALLBACK_PROMPTS)}")
    print()

    for name, template in FALLBACK_PROMPTS.items():
        prompt_id = f"codeshield-{name}"
        print(f"  pushing {prompt_id} ...", end=" ", flush=True)
        prompt = ChatPromptTemplate.from_messages([("system", template)])
        try:
            url = client.push_prompt(prompt_id, object=prompt)
            print(f"ok → {url}")
        except Exception as exc:
            # "Nothing to commit" means the prompt is already up to date — skip.
            if "Nothing to commit" in str(exc) or "has not changed" in str(exc):
                print("unchanged, skipped")
                continue
            print(f"FAILED: {exc}")
            sys.exit(1)

    print()
    print("Done. Pull in worker with: client.pull_prompt('codeshield-<name>:production')")


if __name__ == "__main__":
    main()
