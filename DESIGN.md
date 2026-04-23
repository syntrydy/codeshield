# Technical Design Document

**Project:** AI Code Review Agent
**Version:** v1 (8-day build)
**Status:** Design locked, not yet implemented
**Audience:** Claude Code, and any human collaborator

This document is the authoritative reference for how the system is built. `CLAUDE.md` at the repo root encodes the non-negotiable rules; this document explains the *why* and the *how*. When they conflict, `CLAUDE.md` wins (it's enforcement; this is context). When this document is silent, defer to `CLAUDE.md` and to the reference docs it links.

---

## Table of contents

1. Product overview
2. User personas and flows
3. High-level architecture
4. Data model
5. Row-Level Security policies
6. The LangGraph agent
7. Prompt management
8. GitHub App integration
9. Webhook contract
10. Posting results to GitHub
11. Internationalization
12. Observability
13. Evaluation methodology
14. Error handling and resilience
15. Security posture
16. Cost controls
17. Deployment topology
18. CI/CD pipeline
19. Testing strategy
20. Open questions and v2 roadmap

---

## 1. Product overview

The AI Code Review Agent is a GitHub App that performs automated, multi-specialist code reviews on pull requests. A developer installs the App on a repository; every opened or updated pull request triggers a review run that executes four parallel specialist agents (Security, Correctness, Performance, Style), aggregates their findings, and posts the result back to GitHub as a Check Run with line-level annotations.

The user-facing dashboard surfaces the same reviews with deeper detail — full agent traces, cost breakdowns, historical runs across projects — and lets project owners configure specialist selection, severity thresholds, and review output language.

**What makes this a portfolio project rather than a toy:**

- Production-grade agent architecture with bounded fan-out, structured outputs, and graceful specialist failure
- Prompt management with versioning, semantic tags, and in-memory caching
- Evaluation suite run in CI with precision/recall metrics on a curated PR dataset
- Full observability via LangSmith traces plus CloudWatch infra logs
- Real GitHub integration (App, not OAuth tool) with Check Run annotations
- Bilingual output (English + French) driven by project-level locale configuration
- Infrastructure as code via Terraform
- Supabase + AWS hybrid architecture demonstrating modern cloud composition

**Explicitly out of scope for v1:** PR comment posting (Check Runs only), multi-tenant team accounts, self-hosted GitHub Enterprise support, model-provider fallback, non-English/French output, branch-filter UI (DB-only setting in v1).

## 2. User personas and flows

### 2.1 Personas

**Project Owner.** The person who installs the GitHub App on one or more repositories. Signs into the dashboard, configures project settings, reads reviews. Typically the repository owner or a lead maintainer.

**PR Author.** Opens or updates a pull request in a repository where the App is installed. Does not necessarily have a dashboard account. Sees review results as GitHub Check Run annotations on their PR.

The v1 permission model is deliberately simple: the user who installs the App is the Project Owner for all repos granted access. Team accounts and per-repo permissions are v2 work.

### 2.2 First-time installation flow

1. User visits the marketing page, clicks "Sign in with GitHub". Supabase Auth handles the OAuth flow; we receive a session with the user's GitHub username and a Supabase JWT.
2. Post-signin dashboard shows an empty state: "Install the GitHub App on a repository to start reviewing pull requests."
3. User clicks "Install". We redirect to `https://github.com/apps/<app-slug>/installations/new`.
4. On GitHub's installation UI, the user selects an account (personal or org) and which repositories to grant access to (all or selected). GitHub handles this UI natively.
5. GitHub redirects back to our `/integrations/github/install-callback` endpoint with `?installation_id=<id>&setup_action=install`.
6. The callback handler:
   - Verifies the user is authenticated.
   - Calls GitHub's `/app/installations/{installation_id}` endpoint (authenticated as the App via a JWT signed with the App's private key) to fetch installation details.
   - Creates a `github_app_installations` row linking this installation to the user.
   - Fetches the list of repositories accessible under this installation (`/installation/repositories`).
   - Creates one `projects` row per accessible repository.
   - Redirects to the dashboard.
7. Dashboard now lists the connected repositories as projects.

### 2.3 Automated review flow

1. A PR author opens or pushes to a pull request on a connected repository.
2. GitHub sends a webhook event (`pull_request.opened`, `pull_request.synchronize`, or `pull_request.reopened`) to our `/webhooks/github` endpoint.
3. The webhook handler:
   - Verifies the HMAC signature (`X-Hub-Signature-256`).
   - Checks the `X-GitHub-Delivery` header against the Redis idempotency set; drops if duplicate.
   - Matches `repository.full_name` to a Project row.
   - Applies the debounce rule (see §9.4): if a run for this PR was queued within the last 60 seconds, cancel the prior run and reschedule.
   - Creates a `runs` row with `status='queued'` and `project_id` set.
   - Enqueues the review task via `dispatch_review()` (SQS in production, daemon thread locally).
   - Returns 202 within ~100ms.
4. An AWS Lambda invocation picks up the SQS message.
5. The worker creates a Check Run on GitHub via the Checks API with `status='queued'` (visible in the PR UI immediately).
6. The worker updates the Check Run to `status='in_progress'` and invokes the LangGraph review pipeline (see §6).
7. As the graph executes, the worker emits events to the `run_events` table. The project owner, viewing the run in the dashboard, sees events stream in via Supabase Realtime.
8. On graph completion, the worker:
   - Updates the `runs` row to `status='completed'`.
   - Writes each finding to the `findings` table.
   - Updates the Check Run to `conclusion='success'` (if no blockers) or `conclusion='action_required'` (if critical findings).
   - Populates the Check Run's `output` with a markdown summary and up to 50 annotations per update, paginating if necessary.
9. The PR author sees the Check Run in the GitHub PR UI. Line-level annotations appear inline on the Files Changed tab. The Project Owner sees the full review in the dashboard.

### 2.4 Dashboard consumption flow

1. User signs in, lands on the dashboard root.
2. Sidebar lists all their projects.
3. Clicking a project shows the project detail page: settings (specialists enabled, severity threshold, review output language), list of recent runs with status, PR link, and finding counts.
4. Clicking a run shows:
   - The agent trace timeline (events from `run_events` in chronological order, each labeled and timestamped).
   - Findings grouped by specialist, with severity badges, file/line context, explanation, and optional suggested fix.
   - Cost breakdown (input tokens, output tokens, total USD).
   - Deep link to the LangSmith trace for full observability.
   - Deep link to the GitHub Check Run.

## 3. High-level architecture

### 3.1 System components

**Browser (React + shadcn + Vite + TypeScript).** Hosted on CloudFront + S3. Authenticates via Supabase Auth (GitHub OAuth). Talks to the FastAPI backend for mutations and to Supabase directly for queries and Realtime subscriptions. Internationalized via `react-i18next` with `en` and `fr` locales.

**FastAPI API service (Python 3.12 on AWS App Runner).** Handles user-facing HTTP routes. Verifies Supabase JWTs on every request. Creates runs, exposes project CRUD, handles the GitHub App installation callback. Does *not* execute the LLM pipeline — it dispatches work to SQS and returns fast.

**AWS Lambda worker (Python 3.12, container image).** Triggered by SQS. Runs the LangGraph review pipeline. Writes to Supabase with the service-role client. Posts Check Runs to GitHub. The only component that talks to the LLM provider (OpenAI primary, Anthropic optional fallback). Maximum 15-minute execution time; our internal timeout is 10 minutes.

**FastAPI webhook endpoint (same App Runner service as API, separate route namespace).** Receives GitHub webhooks. Verifies HMAC signatures. Does not require user JWT. Sends messages to SQS. Lives at `/webhooks/github`.

**ElastiCache Serverless (Redis-compatible).** Idempotency set for webhook delivery IDs. Installation token cache (55-minute TTL). Pay-per-use; no always-on broker.

**Supabase (hosted, us-east-1 to match AWS).** Managed Postgres with `pgvector`, Supabase Auth (GitHub OAuth provider enabled), Supabase Realtime. RLS enforced on all user-facing tables.

**S3.** Two buckets: `artifacts` (PR diffs keyed by commit SHA, generated reports, 7-day lifecycle policy) and `terraform-state` (remote state with DynamoDB lock).

**AWS Secrets Manager.** The GitHub App private key (`.pem`), webhook shared secret, Supabase service-role key, OpenAI key (and optional Anthropic fallback key), LangSmith key. Injected into App Runner via the instance IAM role; Lambda reads them on cold start via `_bootstrap_secrets()`.

**LangSmith (SaaS).** Traces, prompt Hub, eval dataset and runs.

**GitHub.** External dependency. Source of PRs, target of Check Runs. Communicates via GitHub App authentication (not user OAuth).

### 3.2 Data flows

**Write path (review trigger to stored findings):**
GitHub webhook → FastAPI webhook endpoint (App Runner) → SQS → Lambda worker → LangGraph execution → Supabase (run_events, runs, findings) → GitHub Check Run API.

**Read path (dashboard):**
Browser → Supabase PostgREST (direct query with user JWT, RLS enforced) for runs, findings, projects.
Browser → Supabase Realtime (WebSocket, RLS enforced) for live run_events.
Browser → FastAPI for mutations (create project via install callback, update project settings).

**Auth path:**
Browser → Supabase Auth (GitHub OAuth dance) → Supabase JWT in browser localStorage (managed by Supabase client).
Browser → FastAPI with JWT in `Authorization: Bearer <token>` header → FastAPI verifies JWT with Supabase JWT secret.

### 3.3 Key architectural decisions, with rationale

**Why Supabase for Postgres + Auth + Realtime instead of RDS + Cognito + SSE?**
Three infrastructure concerns collapse into one managed service. The Realtime piece is the biggest win: workers write `run_events` rows; the browser subscribes to `postgres_changes`. Event persistence and fan-out happen in a single write, with no SSE sticky sessions, no Redis pub/sub for user-facing streaming, and no custom WebSocket server. The trade-off is cross-cloud latency, mitigated by region-matching to `us-east-1`.

**Why SQS + Lambda instead of Celery + ECS?**
Reviews run 30 seconds to several minutes. FastAPI BackgroundTasks run in the same process and would block API health. Celery requires always-on ECS tasks (minimum ~$30/month) plus a Redis cluster. SQS + Lambda is pay-per-invocation: zero cost when idle, scales instantly, and eliminates the broker entirely. Lambda's 15-minute hard limit is workable with a 10-minute internal timeout. Local development uses a daemon thread (`TASK_BACKEND=local`) with the same `run_review()` function, keeping the local story simple.

**Why a GitHub App instead of OAuth tokens?**
OAuth gives access tokens tied to a user; they expire quickly, carry the user's full repo scope, and cannot post Check Runs as a distinct identity. A GitHub App has its own identity (reviews appear as "AI Code Review Agent"), fine-grained permissions (only read code, write checks, read PRs), short-lived installation tokens (better security posture), and webhook support (the core of the product). OAuth is a dev shortcut; the App is the correct architecture.

**Why four specialists instead of one big reviewer?**
A single prompt covering all review dimensions produces either shallow coverage or 10,000-token prompts. Separating concerns gives better output per token, enables parallel execution, lets us tune each specialist independently, and maps cleanly to the eval methodology (we can measure precision/recall per dimension).

**Why LangGraph rather than a custom orchestrator?**
State machines with fan-out, bounded loops, and human-in-the-loop checkpointing are exactly LangGraph's domain. Writing this from scratch would burn a day with no portfolio upside — "I used LangGraph" is a positive signal; "I wrote my own agent framework" invites skepticism about what was reinvented poorly.

## 4. Data model

All tables in the `public` schema unless noted. All `id` columns are UUID v4 defaulted from `uuid_generate_v4()` unless noted (events and webhook deliveries use `bigserial` for insertion throughput).

### 4.1 `github_app_installations`

One row per GitHub App installation. A user may have multiple installations (e.g., one personal, one for an organization they own).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users(id)` | owner of the installation |
| `installation_id` | bigint UNIQUE | GitHub's installation ID |
| `account_login` | text | e.g. `acme-org` |
| `account_type` | text CHECK IN (`User`,`Organization`) | |
| `suspended_at` | timestamptz NULL | set when GitHub suspends the installation |
| `created_at` | timestamptz default `now()` | |

### 4.2 `projects`

One row per connected repository. Many projects per installation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `auth.users(id)` | denormalized for RLS convenience |
| `installation_id` | uuid FK → `github_app_installations(id)` ON DELETE CASCADE | |
| `github_repo_id` | bigint UNIQUE | GitHub's repo ID (stable across renames) |
| `github_repo_full_name` | text | e.g. `acme-org/payments-api` |
| `default_branch` | text | from GitHub; refreshed opportunistically |
| `branch_filter` | text NULL | if set, only review PRs whose base matches; NULL = review all |
| `enabled_specialists` | text[] default `ARRAY['security','correctness','performance','style']` | |
| `severity_threshold` | text default `'low'` CHECK IN (`info`,`low`,`medium`,`high`,`critical`) | findings below this don't post to GitHub (always stored) |
| `review_output_locale` | text default `'en'` CHECK IN (`en`,`fr`) | language for Check Run content |
| `created_at` | timestamptz default `now()` | |

### 4.3 `runs`

One row per review run.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects(id)` ON DELETE CASCADE | |
| `user_id` | uuid FK → `auth.users(id)` | denormalized from project for fast RLS |
| `pr_number` | int | |
| `pr_head_sha` | text | the commit reviewed |
| `pr_base_sha` | text | |
| `trigger_event` | text CHECK IN (`opened`,`synchronize`,`reopened`,`manual`) | |
| `status` | text default `'queued'` CHECK IN (`queued`,`running`,`completed`,`failed`,`cancelled`) | |
| `github_check_run_id` | bigint NULL | set after the Check Run is created |
| `total_input_tokens` | int default 0 | accumulated during the run |
| `total_output_tokens` | int default 0 | |
| `total_cost_usd` | numeric(10,4) default 0 | |
| `error_message` | text NULL | populated on `failed` |
| `created_at` | timestamptz default `now()` | |
| `started_at` | timestamptz NULL | |
| `completed_at` | timestamptz NULL | |

Indexes: `(project_id, created_at DESC)` for dashboard listing; `(pr_head_sha)` for deduplication queries.

### 4.4 `run_events`

Streaming event log. High insert rate — use `bigserial`.

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `run_id` | uuid FK → `runs(id)` ON DELETE CASCADE | |
| `event_type` | text | see event taxonomy below |
| `payload` | jsonb default `'{}'` | event-specific data |
| `created_at` | timestamptz default `now()` | |

Index: `(run_id, created_at)` for ordered reads.

**Event taxonomy (canonical list):**
- `run.queued`, `run.started`, `run.completed`, `run.failed`, `run.cancelled`
- `planner.started`, `planner.completed`
- `specialist.started` (payload: `{specialist}`)
- `specialist.tool_call` (payload: `{specialist, tool, args}`)
- `specialist.finding` (payload: `{specialist, finding}`)
- `specialist.completed` (payload: `{specialist, finding_count}`)
- `specialist.failed` (payload: `{specialist, error}`)
- `aggregator.started`, `aggregator.completed` (payload: `{total_findings}`)
- `github.check_run_updated` (payload: `{check_run_id, status, conclusion}`)

### 4.5 `findings`

Structured review findings.

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `run_id` | uuid FK → `runs(id)` ON DELETE CASCADE | |
| `specialist` | text CHECK IN (`security`,`correctness`,`performance`,`style`) | |
| `severity` | text CHECK IN (`info`,`low`,`medium`,`high`,`critical`) | canonical English |
| `file_path` | text NULL | relative to repo root |
| `line_start` | int NULL | 1-indexed |
| `line_end` | int NULL | 1-indexed, inclusive |
| `title` | text | short (≤80 char) summary |
| `explanation` | text | full reasoning, in `review_output_locale` |
| `suggested_fix` | text NULL | code or prose suggestion |
| `confidence` | text default `'medium'` CHECK IN (`low`,`medium`,`high`) | specialist's self-rated confidence |
| `created_at` | timestamptz default `now()` | |

Index: `(run_id, severity)` for filtered dashboard views.

### 4.6 `webhook_deliveries`

Idempotency log. TTL-purged after 7 days by a scheduled job.

| Column | Type | Notes |
|---|---|---|
| `delivery_id` | text PK | GitHub's `X-GitHub-Delivery` |
| `event_type` | text | e.g. `pull_request` |
| `repo_full_name` | text | |
| `received_at` | timestamptz default `now()` | |

Note: this table is a Postgres backup for the Redis idempotency set. Redis is the primary; Postgres is the audit trail.

### 4.7 `user_preferences`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK FK → `auth.users(id)` ON DELETE CASCADE | |
| `ui_locale` | text default `'en'` CHECK IN (`en`,`fr`) | |
| `updated_at` | timestamptz default `now()` | |

### 4.8 `prompt_cache`

Not a DB table — Python process memory. Documented here for completeness. Structure: `dict[tuple[str, str], str]` keyed by `(prompt_name, version)`, values are the resolved prompt template. Populated lazily on first access, never evicted within a worker's lifetime.

## 5. Row-Level Security policies

RLS is enforced on every user-facing table. Workers use the service-role client, which bypasses RLS by design.

```sql
alter table public.github_app_installations enable row level security;
alter table public.projects enable row level security;
alter table public.runs enable row level security;
alter table public.run_events enable row level security;
alter table public.findings enable row level security;
alter table public.user_preferences enable row level security;

-- Installations: user sees their own
create policy "own installations" on public.github_app_installations
  for select using (auth.uid() = user_id);

-- Projects: user sees their own (user_id is denormalized for this)
create policy "own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "update own projects" on public.projects
  for update using (auth.uid() = user_id);

-- Runs: user sees their own
create policy "own runs" on public.runs
  for select using (auth.uid() = user_id);

-- Run events: chain through run_id
create policy "own run events" on public.run_events
  for select using (
    run_id in (select id from public.runs where user_id = auth.uid())
  );

-- Findings: chain through run_id
create policy "own findings" on public.findings
  for select using (
    run_id in (select id from public.runs where user_id = auth.uid())
  );

-- User preferences: own only
create policy "own preferences" on public.user_preferences
  for all using (auth.uid() = user_id);

-- Writes: no user-facing INSERT/UPDATE policies on runs/events/findings.
-- These are service_role only (worker writes).
```

**The denormalized `user_id` on `projects` and `runs`** is deliberate. Chaining RLS through three levels (run → project → installation → user) produced visible query latency in testing. Denormalizing lets us do a direct equality check and maintain sub-10ms query times on the dashboard.

**Testing RLS is mandatory.** Every query must be tested in three roles:
1. service_role: sees everything (used by worker).
2. authenticated as owner: sees their rows only.
3. authenticated as another user: sees zero rows.

The Supabase SQL editor has a role switcher. Integration tests insert rows as user A and assert user B gets empty results.

## 6. The LangGraph agent

### 6.1 State schema

```python
from typing import Annotated, Literal, TypedDict
from operator import add

class ReviewState(TypedDict):
    # Inputs
    run_id: str
    project_id: str
    pr_url: str
    pr_head_sha: str
    pr_base_sha: str
    locale: Literal["en", "fr"]
    enabled_specialists: list[str]

    # Planner output
    plan: dict | None               # {scope, focus_areas, skip_reasons}
    changed_files: list[str]

    # Specialist outputs — reducer concatenates across parallel branches
    findings: Annotated[list[dict], add]
    specialist_errors: Annotated[list[dict], add]

    # Aggregator output
    final_review: dict | None       # {summary, findings_by_severity, verdict}
```

The `Annotated[list, add]` pattern is what makes parallel fan-out safe. Without it, the last specialist to finish overwrites the others' findings.

### 6.2 Graph topology

```
START → planner → fan-out(specialists) → aggregator → END
```

`planner` returns a `Send(...)` list (one per enabled specialist) to LangGraph, triggering parallel execution. Each specialist runs as a subgraph with its own ReAct loop. The graph's reducer concatenates findings as specialists complete.

### 6.3 The Planner

**Purpose:** fetch PR context, classify the change, decide which specialists to run and which files each should focus on.

**Tools:** `get_pr_metadata(pr_url)`, `get_changed_files(pr_url)`, `get_file_content(path, ref)` (small files only; specialists fetch larger files themselves).

**Outputs:**
- `plan`: `{change_type: 'feature'|'bugfix'|'refactor'|'docs'|'chore', focus_areas: list[str], skip_specialists: list[str]}`
- `changed_files`: full list
- A `Send` object per enabled specialist (minus skipped ones).

**Model:** OpenAI `gpt-4o` (Anthropic Claude Sonnet 4.5 as optional fallback). This is the classification and planning step — worth the better model. Budget: 8K input tokens, 1K output tokens.

**Skipping logic:** docs-only PRs skip Security and Performance. Dependency-bump PRs skip Style. Configuration-only PRs skip Correctness. These heuristics save 60%+ of cost on common PR types and must be explicit in the planner's system prompt.

### 6.4 The Specialists

Each specialist is a ReAct-style loop: reason about the PR → call a tool → reason again → eventually emit findings. Max 6 tool-call iterations per specialist (hard bound — emit findings with whatever evidence gathered, don't loop forever).

**Shared tools** (all specialists can call these):
- `get_file_content(path, ref)` — fetches a file from the PR head
- `get_diff(path)` — fetches the diff for one file
- `grep_repo(pattern, path_glob)` — ripgrep against the repo (shallow clone cached in S3)
- `list_directory(path)` — directory listing
- `get_adjacent_code(path, line, context_lines)` — fetches N lines around a specific line (for specialists that found something on line 47 and want to see lines 40-60)

**Specialist-specific characteristics:**

| Specialist | Focus | Extra tool(s) | Model |
|---|---|---|---|
| Security | auth/authz, secrets, injection, deserialization, crypto, input validation | — | gpt-4o-mini |
| Correctness | logic errors, edge cases, error handling, race conditions, off-by-one | — | gpt-4o-mini |
| Performance | N+1 queries, inefficient loops, memory, async misuse, blocking I/O | — | gpt-4o-mini |
| Style | naming, idiom, API design, documentation, consistency with repo conventions | — | gpt-4o-mini |

Each specialist emits zero or more findings conforming to the `Finding` Pydantic schema. Each finding must have `severity`, `title`, `explanation`, `confidence`, and optionally `file_path`, `line_start`, `line_end`, `suggested_fix`.

### 6.5 The Aggregator

**Purpose:** deduplicate overlapping findings from different specialists, rank by severity and confidence, produce the final review summary.

**Inputs:** all findings concatenated from specialists, planner's plan, state metadata.

**Outputs:**
- `final_review.summary` — 2-3 paragraph overview in `locale`
- `final_review.findings` — deduplicated, ranked list
- `final_review.verdict` — `approve`, `request_changes`, or `comment` (informs Check Run conclusion)

**Deduplication rule:** two findings are duplicates if they share (file_path, line_start, line_end) with overlap ≥50%. Keep the one with higher severity; if equal severity, keep higher confidence; if equal, keep the one from the more-specific specialist (Security > Correctness > Performance > Style when they overlap).

**Model:** OpenAI `gpt-4o` (Anthropic Claude Sonnet 4.5 as optional fallback). The aggregator makes judgment calls about severity and deduplication — worth the better model.

### 6.6 Error handling inside the graph

Every specialist node is wrapped:

```python
def safe_specialist(name):
    def wrapper(state):
        try:
            result = run_specialist(name, state)
            return result
        except Exception as e:
            emit_event(state['run_id'], f'{name}.failed', {'error': str(e)})
            return {
                'specialist_errors': [{'specialist': name, 'error': str(e)}],
                'findings': [],
            }
    return wrapper
```

One specialist failing is not a run failure. The run fails only if the Planner or Aggregator fails, or if every specialist fails.

## 7. Prompt management

### 7.1 Where prompts live

All specialist and orchestrator prompts live in LangSmith Hub. Structure:

```
ai-reviewer/planner           → versioned
ai-reviewer/security          → versioned
ai-reviewer/correctness       → versioned
ai-reviewer/performance       → versioned
ai-reviewer/style             → versioned
ai-reviewer/aggregator        → versioned
```

Each has a `production` tag pinned to a specific version, and `staging` pointing to the latest candidate. Workers pull `production`; evals run on both.

### 7.2 Pull and cache pattern

```python
from functools import lru_cache
from langsmith import Client

_langsmith = Client()

@lru_cache(maxsize=32)
def get_prompt(name: str, tag: str = "production"):
    try:
        return _langsmith.pull_prompt(f"ai-reviewer/{name}:{tag}")
    except Exception:
        return FALLBACK_PROMPTS[name]   # bundled in the repo

FALLBACK_PROMPTS = {...}  # reasonable defaults in code, for outages
```

Pulled at worker boot (warm-up function called during module import of the graph module), cached for the worker's lifetime. A redeploy is required to pick up new prompt versions — intentional, so we get deliberate promotion rather than drift.

### 7.3 Prompt variables

Every specialist prompt accepts:
- `{locale}` — `en` or `fr`, controls output language
- `{plan}` — the planner's plan (JSON-serialized)
- `{changed_files}` — list of changed file paths
- `{severity_guidance}` — project's severity threshold, injected as a hint

The prompt instructs the model to respond in `{locale}`, keep technical terms in English regardless of locale, and ground every finding in a specific file/line.

### 7.4 Version promotion workflow

1. Engineer edits a prompt in LangSmith Hub, saving as a new version (staging tag auto-updates).
2. Eval suite runs automatically on the staging version (triggered by a LangSmith webhook or CodeBuild nightly).
3. Results compared against production baseline: precision, recall, cost, latency.
4. If staging is a regression on any of the four, block promotion.
5. On approval, tag the staging version as production. A service deploy picks up the change.

## 8. GitHub App integration

### 8.1 App registration

The App is registered once, manually, using a GitHub App manifest flow (script provided in `scripts/register-app.sh`). This produces:

- The App ID (public)
- The webhook secret (stored in AWS Secrets Manager as `github/webhook_secret`)
- The private key `.pem` (stored as `github/private_key`)
- The client ID and secret (unused in v1 — we don't use the App for user OAuth, we use Supabase's GitHub OAuth provider for that)

**Permissions requested (minimum viable):**
- Repository: Contents (read), Pull requests (read), Checks (write), Metadata (read)
- Events subscribed: `pull_request`, `installation`, `installation_repositories`

Public page: the App has a public listing page at `github.com/apps/<slug>`. In v1 we don't publish to Marketplace — installation is by direct URL.

### 8.2 Installation token minting

```python
import jwt, time, httpx
from functools import lru_cache

def _app_jwt() -> str:
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 540, "iss": settings.github_app_id}
    return jwt.encode(payload, settings.github_private_key, algorithm="RS256")

def get_installation_token(installation_id: int) -> str:
    cached = redis.get(f"gh:token:{installation_id}")
    if cached:
        return cached.decode()
    resp = httpx.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers={"Authorization": f"Bearer {_app_jwt()}", "Accept": "application/vnd.github+json"},
    )
    resp.raise_for_status()
    token = resp.json()["token"]
    redis.setex(f"gh:token:{installation_id}", 55 * 60, token)
    return token
```

55-minute TTL (GitHub tokens live 60 minutes; we refresh with a 5-minute buffer).

### 8.3 Installation callback flow

Endpoint: `GET /integrations/github/install-callback`
Query params: `installation_id`, `setup_action` (`install` or `update`), plus Supabase session cookie.

1. Authenticate the user via the Supabase JWT in the cookie. If absent, redirect to sign-in with the callback URL preserved.
2. Fetch installation details: `GET /app/installations/{installation_id}` authenticated as the App.
3. Upsert into `github_app_installations`: `(user_id, installation_id, account_login, account_type)`.
4. Fetch repos: `GET /installation/repositories` with the installation token.
5. For each repo, upsert into `projects` with default settings (all specialists enabled, `severity_threshold='low'`, `review_output_locale=user_preferences.ui_locale`).
6. Redirect to `/dashboard?installed=1`.

### 8.4 Installation lifecycle webhooks

We subscribe to `installation` and `installation_repositories` events to handle lifecycle transitions:

- `installation.created` — already handled by the callback, but webhook serves as a backup.
- `installation.suspend` — mark `suspended_at` on the installation row. Projects become read-only; new PRs don't trigger reviews.
- `installation.unsuspend` — clear `suspended_at`.
- `installation.deleted` — delete the installation row (cascade to projects and runs).
- `installation_repositories.added` — create new `projects` rows.
- `installation_repositories.removed` — delete the corresponding `projects` rows (cascade to runs).

## 9. Webhook contract

### 9.1 Endpoint

`POST /webhooks/github`

Headers:
- `X-GitHub-Event`: the event type
- `X-GitHub-Delivery`: unique UUID per delivery
- `X-Hub-Signature-256`: HMAC signature

### 9.2 Signature verification

First middleware. Constant-time comparison:

```python
import hmac, hashlib

def verify_signature(body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
```

If verification fails, return 401 immediately. Do not log the body (it may contain sensitive code).

### 9.3 Idempotency

Redis set operation: `SETNX delivery:<id> 1 EX 86400`. If it returns 0, the delivery is a duplicate — return 200 immediately without enqueuing work (GitHub considers 2xx a successful delivery and won't retry).

### 9.4 Debounce on push storms

Before enqueueing a review for a `pull_request.synchronize`:

1. Query Redis for `pr_debounce:<project_id>:<pr_number>`.
2. If present and within 60 seconds, the webhook handler returns 200 (the already-queued SQS message will process after the debounce window expires).
3. Store the new task ID under the debounce key with 60-second TTL.

The effect: five rapid pushes result in one review after the last push settles for 60 seconds.

### 9.5 Supported events and handling

| Event + action | Handler |
|---|---|
| `pull_request.opened` | create run, enqueue review |
| `pull_request.synchronize` | create run (or debounce), enqueue review |
| `pull_request.reopened` | create run, enqueue review |
| `pull_request.closed` | no-op (v1); cancel in-flight run in v2 |
| `installation.created` | backup upsert (primary: callback) |
| `installation.suspend` | update installation row |
| `installation.unsuspend` | update installation row |
| `installation.deleted` | delete installation and cascade |
| `installation_repositories.added` | insert projects |
| `installation_repositories.removed` | delete projects |

All other events: return 200 without processing (GitHub may send many event types depending on permissions).

### 9.6 Response contract

Always return within 10 seconds or GitHub retries. Target <500ms. Response body is unused — status code only matters.

- `200`: processed (including duplicates and no-op events)
- `202`: accepted, queued for async processing (standard response)
- `401`: signature verification failed
- `400`: malformed payload
- `500`: unexpected error — GitHub will retry with exponential backoff

## 10. Posting results to GitHub

### 10.1 Check Run lifecycle

Three updates per run:

1. **Queued** (after webhook received, worker not yet started): `POST /repos/{owner}/{repo}/check-runs` with `status='queued'`, `external_id=run_id`. Captures `github_check_run_id`.
2. **In progress** (worker started graph): `PATCH` with `status='in_progress'`.
3. **Completed** (graph finished): `PATCH` with `status='completed'`, `conclusion` (see below), `output` with title, summary, text, and annotations.

### 10.2 Conclusion mapping

| Worst finding severity | Conclusion |
|---|---|
| `critical` or `high` | `action_required` |
| `medium` | `neutral` |
| `low` or `info` only | `success` |
| No findings | `success` |

`action_required` is what makes the check visible as a "required" item in branch-protection-ready repos.

### 10.3 Annotations

Check Run annotations are how findings attach to specific file/line ranges.

- Max 50 annotations per `PATCH` request. If we have more, paginate: first PATCH with 50, subsequent PATCHes appending more.
- Each annotation: `path`, `start_line`, `end_line`, `annotation_level` (`notice`|`warning`|`failure`), `title`, `message`, `raw_details`.
- Severity mapping:
  - `critical`, `high` → `failure`
  - `medium` → `warning`
  - `low`, `info` → `notice`
- Findings below the project's `severity_threshold` do NOT get annotations, but are still stored in the DB and visible in the dashboard.

### 10.4 Summary template

Localized (English and French versions), stored as Jinja templates in `api/app/templates/check_run/`:

```
{{ verdict_line }}

## {{ t('summary_heading') }}
{{ summary_paragraph }}

## {{ t('findings_by_severity') }}
- {{ t('severity.critical') }}: {{ critical_count }}
- {{ t('severity.high') }}: {{ high_count }}
- {{ t('severity.medium') }}: {{ medium_count }}
- {{ t('severity.low') }}: {{ low_count }}
- {{ t('severity.info') }}: {{ info_count }}

{{ t('dashboard_link') }}: {{ dashboard_url }}
```

## 11. Internationalization

### 11.1 Frontend i18n

Stack: `i18next` + `react-i18next` + `i18next-browser-languagedetector`.

File structure:
```
web/src/i18n/
  index.ts       # initialization
  en.json        # English
  fr.json        # French
```

Detection priority: user preference from DB (if signed in) → localStorage → browser language → `en`.

Every user-facing string goes through `const { t } = useTranslation(); t('some.key')`. No exceptions, enforced via a lint rule (custom ESLint rule that flags JSX string literals inside element bodies, with a suppress comment if genuinely non-translatable).

### 11.2 Locale flow for review output

```
User signs up                  → user_preferences.ui_locale = browser default (en/fr)
User installs App              → new projects default review_output_locale = user.ui_locale
User changes project setting   → project.review_output_locale updated
Webhook fires for PR           → worker reads project.review_output_locale
Worker invokes graph           → state.locale = project.review_output_locale
Specialists generate findings  → explanations in state.locale
Aggregator writes summary      → summary in state.locale
Check Run posted to GitHub     → summary template rendered in state.locale
```

**Severity enums stay English in the DB** (`low`, `critical`, etc.). They're translated at display time — in the dashboard via `t('severity.critical')`, in Check Run summaries via the Jinja template's `t()` filter.

### 11.3 Prompts and locale

Specialist system prompts include:

> Respond in {{locale}}. When {{locale}} is `fr`, write your explanations and suggested fixes in French, but keep the following technical terms in English: `pull request`, `commit`, `branch`, `webhook`, `merge`, `rebase`, `diff`, `null`, `undefined`, programming keywords, library names, and code identifiers. Code snippets remain unchanged regardless of locale.

### 11.4 Translation quality gates

Before shipping, the `fr.json` is reviewed by a human French speaker (project owner — you). LLM-generated translations are a starting point, not a finished product. Particular attention to:

- Severity translations: use domain-appropriate terms (`Critique`, `Élevé`, `Moyen`, `Faible`, `Info`)
- "Finding" → `Remarque` for info/low, `Problème` for medium+
- "Review" → `Revue de code`
- Technical terms listed above remain English

## 12. Observability

### 12.1 LangSmith

Every graph invocation produces a trace. Trace metadata includes:
- `run_id` (our DB ID, for cross-referencing)
- `project_id`
- `pr_url`
- `locale`
- `user_id`

Tags: `specialist:{name}`, `tool:{name}` for filtering. Auto-captured token counts roll up to cost.

The dashboard's run detail view deep-links to the LangSmith trace URL, constructed as:
`https://smith.langchain.com/o/<org>/projects/p/<project>/r/<trace_id>`

### 12.2 CloudWatch

App Runner and Lambda emit logs to CloudWatch Logs. Log groups:
- `/apprunner/code-review-api` (App Runner service)
- `/aws/lambda/code-review-worker` (Lambda worker)

Metrics we emit:
- `review.duration.ms` (per completed run)
- `review.cost.usd` (per completed run)
- `review.findings.count` (per completed run)
- `webhook.received.count` (per event type)
- `webhook.deduplicated.count`
- `github.api.rate_limit_remaining` (sampled per installation)
- `llm.rate_limit.hit.count`

### 12.3 Structured logging

Every log line is JSON with at minimum: `timestamp`, `level`, `message`, `run_id` (if in a run context), `project_id`, `correlation_id` (the `X-GitHub-Delivery` for webhook-triggered work).

### 12.4 Alerting (v2 — not in v1)

Notes for future: CloudWatch alarms on Lambda errors, Dead Letter Queue depth, LangSmith-reported error rate > 5%, p95 review duration > 5 minutes.

## 13. Evaluation methodology

### 13.1 Dataset

10-15 curated public PRs. Sources:
- GitHub Security Advisories (PRs that fixed real CVEs — gold standard for Security)
- Reverted PRs from large open-source repos (Correctness ground truth)
- High-engagement review threads on Rails, Django, Next.js, etc. (the community already labeled what's wrong)

For each PR, we label:
- `expected_findings`: list of `{specialist, file, line_range, description, severity}` that the review *should* catch.
- `negative_findings`: findings that would be wrong to raise (to measure precision).
- `expected_verdict`: `approve` | `request_changes` | `comment`.

Stored as YAML under `evals/dataset/` and loaded into LangSmith as a dataset.

### 13.2 Metrics

Per run on the eval set:
- **Recall**: fraction of `expected_findings` that the review produced a matching finding for (match = same file + line overlap ≥50% + severity within one level).
- **Precision**: fraction of produced findings that are either expected or not in `negative_findings`.
- **False positive rate**: findings in `negative_findings` that were raised.
- **Verdict accuracy**: fraction of runs where the produced verdict matches `expected_verdict`.
- **Cost per review**: median USD across the dataset.
- **Latency**: p50, p95 total review duration.

Per-specialist breakdowns on recall and precision so we can tune individually.

### 13.3 LLM-as-judge

For each finding produced, a judge prompt (separate from the reviewer) rates it on:
- **Correctness** (1-5): is the finding factually right about the code?
- **Usefulness** (1-5): would a maintainer find this actionable?
- **Specificity** (1-5): does it point to a precise issue vs. vague?

Judge uses OpenAI `gpt-4o`. Judge prompts are themselves versioned. Judge results are advisory, not replacing objective match metrics.

### 13.4 CI integration

CodeBuild `test` project runs a fast eval (3 PRs) on every push. A nightly scheduled job runs the full eval suite and posts results to LangSmith and to a dashboard page.

Regression gate: PRs cannot merge to `main` if they cause >5% drop in recall or >10% increase in false positive rate vs. the last green run.

## 14. Error handling and resilience

### 14.1 Failure modes and responses

| Failure | Effect | Recovery |
|---|---|---|
| LLM rate limit hit (OpenAI 429) | Semaphore blocks; caller waits. If Anthropic fallback configured, request fails over | Natural — the semaphore serializes calls |
| LLM 5xx | Exponential backoff, 3 retries | If still failing: specialist marked failed, run continues |
| GitHub API rate limit (installation) | Back off to next hour | Reviews queued; user sees "waiting for GitHub" |
| GitHub 5xx on Check Run post | Exponential backoff, 5 retries | If still failing: run marked completed, Check Run missing (rare, acceptable) |
| Supabase unavailable | Worker cannot write events | Task fails; SQS DLQ retains message for manual replay |
| One specialist throws | `specialist.failed` event emitted | Other specialists continue; aggregator works with what's present |
| Planner throws | Run marked failed | No partial review; user notified in dashboard |
| Aggregator throws | Run marked failed | Partial findings lost for display (retrievable from `findings` table) |
| Lambda crash mid-run | SQS retries (up to 3×) | `run_review()` checks existing run status at entry — idempotent |

### 14.2 Timeout budget

Per-run hard cap: 10 minutes. Enforced by a deadline check inside `run_review()` (Lambda's hard limit is 15 minutes; the 10-minute internal timeout gives 5 minutes for cleanup). Beyond this, a `TimeoutError` is raised and the run is marked `failed`.

Per-LLM-call timeout: 60 seconds. Per-GitHub-API-call timeout: 15 seconds.

### 14.3 Retry policy

- SQS message redelivery: up to 3 attempts (configured on the queue), with the idempotency guard in `run_review()` preventing duplicate work on retry.
- LLM retries: 3, exponential with jitter, only on 429 and 5xx. A 429 that exhausts retries triggers the Anthropic fallback when configured.
- GitHub retries: 5 for Check Run posts, 3 for other operations.
- Webhook processing: no retry — GitHub retries on non-2xx.

## 15. Security posture

### 15.1 Secrets handling

All secrets in AWS Secrets Manager, read via IAM instance role (App Runner) or execution role (Lambda). Never in `.env` files that deploy, never in Docker images, never in git.

Secrets:
- `github/app_id`, `github/private_key`, `github/webhook_secret`
- `supabase/service_role_key`, `supabase/jwt_secret`
- `openai/api_key` (primary)
- `anthropic/api_key` (optional fallback)
- `langsmith/api_key`

Local dev uses a `.env` file that is gitignored; developers have their own non-production secrets.

### 15.2 Code handling

Private repo code is fetched by the worker, processed in memory, and:
- **Persisted short-term** in S3 only as PR diff snapshots (keyed by commit SHA), used for specialist retries without re-fetching. 7-day lifecycle policy auto-deletes.
- **Never persisted** in Postgres. Findings reference files and line ranges by path, not by content.
- **Logged carefully**: code snippets never appear in CloudWatch logs. Log lines are structured with `file_path` and `line_range` fields, not raw content.

### 15.3 Authentication chain

- Browser → Supabase Auth (GitHub OAuth) → Supabase JWT
- Browser → FastAPI: JWT verified with Supabase JWT secret (HS256)
- FastAPI → Supabase: service-role key (worker only) or user JWT pass-through (API)
- Worker → GitHub: installation token (short-lived)
- Webhook → FastAPI: HMAC signature (shared secret)

No credential flows in more than one direction. Each boundary uses the minimum-privilege credential.

### 15.4 Authorization boundaries

- User can only see their own data (enforced by RLS)
- User can only configure projects under their own installations (enforced by FastAPI after installation ownership check)
- Worker bypasses RLS via service-role (trusted component — Lambda runs inside AWS, not reachable from the public internet)
- Webhooks are authenticated as GitHub (signature), not as any user

### 15.5 Known v1 limitations (documented, not exploits)

- No per-project cost limits — a malicious repo owner could DoS their own quota via many large PRs. Out of scope; our ToS would address it in v2.
- No SBOM/dependency scanning on our own deploy artifacts. v2 work.
- Supabase JWT secret, if leaked, lets an attacker impersonate any user. Mitigations: stored in Secrets Manager, rotated manually every 90 days (documented runbook, not automated in v1).

## 16. Cost controls

### 16.1 Per-run token budget

Hard cap per run: 300,000 input tokens, 30,000 output tokens across all specialists combined. Enforced by a running counter in the graph state — when exceeded, the current specialist completes with what it has, remaining specialists are skipped, aggregator still runs.

Soft target (tuned via evals): 80,000 input, 10,000 output. Most reviews come in well under.

### 16.2 Per-user per-month budget

Postponed to v2. In v1 we trust that OpenAI tier limits act as a backstop and that a single portfolio project doesn't attract abuse.

### 16.3 Cost attribution

Every run row has `total_cost_usd`. Aggregates visible in dashboard per project. Makes it easy to identify expensive projects during development.

### 16.4 Model choice as cost lever

Planner + aggregator use `gpt-4o` for the judgment calls; the 4 specialists use `gpt-4o-mini` because they fan out in parallel and would otherwise exceed the `gpt-4o` TPM cap on Tier 1. Anthropic Claude Sonnet 4.5 is kept as an optional 429-fallback when `ANTHROPIC_API_KEY` is set.

## 17. Deployment topology

### 17.1 AWS resources

**No VPC required.** All compute (App Runner, Lambda) is managed by AWS and communicates to Supabase and GitHub over the public internet via HTTPS. ElastiCache Serverless has a public endpoint secured by TLS + auth token.

**Compute:**
- App Runner service: `code-review-api` — auto-scales from 0, 1 vCPU / 2 GB RAM
- Lambda function: `code-review-worker` — container image, 3 GB RAM, 15-minute timeout, triggered by SQS
- SQS queue: `code-review-review-queue` (standard) with DLQ (`code-review-review-dlq`, 3 retries)

**Data:**
- ElastiCache Serverless (Redis-compatible): installation token cache + webhook idempotency set. Pay-per-use, no minimum.
- S3 buckets: `code-review-artifacts-<env>`, `code-review-terraform-state-<env>`
- DynamoDB: `code-review-terraform-locks`

**Frontend:**
- CloudFront distribution → S3 bucket (static React build). Custom domain via ACM cert attached to CloudFront.

**Secrets:** AWS Secrets Manager entries per §15.1.

**CI:** CodeBuild projects: `test`, `build-deploy`, `terraform`. CodeStar connection to GitHub for webhook triggers.

### 17.2 Deployment flow

1. Push to `main` on GitHub
2. CodeBuild `test` runs lint + tests + fast eval
3. If green, CodeBuild `build-deploy`:
   - Builds Docker images for API and Lambda worker
   - Pushes to ECR
   - Runs `aws lambda update-function-code` (Lambda picks up image immediately)
   - Runs `aws apprunner start-deployment` (App Runner performs rolling replace with zero downtime)
4. Post-deploy smoke test: hit `/health`, post a known-webhook delivery (test PR in a sentinel repo)

Infrastructure changes:
1. PR against `infra/` → CodeBuild `terraform` runs `terraform plan` and posts to PR
2. Merge to `main` → CodeBuild runs `terraform apply`

### 17.3 Environments

v1 has one environment: production. Staging is v2. Local development uses Docker Compose with Supabase hosted (non-production project) and local Redis. LangSmith uses a `code-review-dev` project to keep traces separated.

## 18. CI/CD pipeline

### 18.1 CodeBuild project: `test`

Trigger: GitHub webhook on any PR or push.

```yaml
# buildspec/test.yml
version: 0.2
phases:
  install:
    runtime-versions:
      python: 3.12
      nodejs: 20
    commands:
      - curl -LsSf https://astral.sh/uv/install.sh | sh
      - export PATH="$HOME/.local/bin:$PATH"
      - npm install -g pnpm
  pre_build:
    commands:
      - cd api && uv sync
      - cd ../web && pnpm install --frozen-lockfile
  build:
    commands:
      - cd api && uv run ruff check . && uv run mypy app && uv run pytest -xvs
      - cd ../web && pnpm lint && pnpm build
      - cd ../api && uv run python -m evals.run --subset=fast
```

Fast eval: 3 PRs from the dataset, blocks merge on >10% regression.

### 18.2 CodeBuild project: `build-deploy`

Trigger: push to `main`.

Builds Docker images, pushes to ECR, updates the Lambda function image, and triggers an App Runner deployment.

### 18.3 CodeBuild project: `terraform`

Trigger: push to `main` affecting `infra/**`.

Runs `terraform plan` on PRs (comments on PR), `terraform apply` on main.

## 19. Testing strategy

### 19.1 Unit tests

- **Python:** pytest with `FakeListChatModel` replacing `ChatOpenAI`, mocked Supabase service client, mocked GitHub httpx client.
- **TypeScript:** Vitest for utility functions. Components tested via integration — no component-level unit tests (low ROI for a portfolio project).

Every graph node has a unit test: input state → expected output state, with LLM responses stubbed.

### 19.2 Integration tests

- **Graph end-to-end:** full review on a fixture PR (checked-in diffs, no live GitHub), stubbed LLM returning canned findings. Asserts correct event sequence, correct finding aggregation, correct error handling on one-specialist-fails.
- **Webhook handler:** POST real GitHub payloads (captured from GitHub's docs examples) to the endpoint, assert correct DB state changes and SQS dispatch call.
- **RLS:** insert rows as user A, query as user B with a different JWT, assert empty results.

### 19.3 Eval tests

Part of the CI pipeline. See §13.

### 19.4 Manual verification

The scaffolding is finished when:
- `docker compose up` brings up API + Redis healthy (worker is Lambda — local dev uses `TASK_BACKEND=local` daemon thread)
- Visiting `http://localhost:5173` loads the React app
- Signing in via GitHub OAuth lands on the dashboard
- Health endpoint returns 200
- A synthetic test run (manually inserted into the DB) streams events to the UI

## 20. Open questions and v2 roadmap

### 20.1 Open questions (unresolved, to revisit)

- Should we offer "review only on request" mode (comment `/review` on a PR) in addition to auto-trigger? Would add user control but complicates the mental model.
- Check Run annotation limit of 50 per update — should we summarize or paginate? v1 paginates; UX test may show summary is cleaner.
- Aggregator dedup rule is heuristic. Could be an LLM judgment call instead. v2 experiment.

### 20.2 v2 roadmap (documented in README)

- **PR comment posting** as an alternative to Check Runs (with configurable preference per project)
- **Team accounts** and per-repo permissions (install is by org, but project owners are individuals)
- **Self-hosted GitHub Enterprise** support (base URL configuration, self-signed cert handling)
- **Cost budgets and quotas** per user per month
- **Model router** with full multi-provider support beyond the current OpenAI-primary / Anthropic-fallback pair
- **Branch-filter UI** (currently DB-only)
- **French eval dataset** so we measure output quality in both languages
- **Webhook secret rotation** UI
- **Multi-environment** deploys (staging, production) with promotion flow
- **Alerting** on error rate, DLQ depth, p95 latency

---

## Appendix A: Naming conventions

- Tables: plural snake_case (`runs`, `findings`, `github_app_installations`)
- Python modules: snake_case
- Python classes: PascalCase
- Python functions: snake_case
- TypeScript components: PascalCase
- TypeScript functions: camelCase
- CSS classes: Tailwind utilities only; custom classes kebab-case
- Environment variables: SCREAMING_SNAKE_CASE
- Secrets Manager paths: `<service>/<purpose>` lowercase with slashes

## Appendix B: File paths referenced in this document

- `CLAUDE.md` — the constitution, read on every session
- `DESIGN.md` — this document
- `README.md` — public-facing, explains architecture and setup
- `api/pyproject.toml` — Python dependencies
- `api/app/graph/state.py` — LangGraph state schema
- `api/app/graph/nodes.py` — planner, specialists, aggregator
- `api/app/graph/graph.py` — graph assembly
- `api/app/worker/tasks.py` — `run_review()` function (plain Python, no broker)
- `api/app/worker/dispatch.py` — `dispatch_review()` (SQS in prod, daemon thread locally)
- `api/app/worker/lambda_handler.py` — Lambda entrypoint, bootstraps secrets on cold start
- `api/app/webhooks/github.py` — webhook handler
- `api/app/core/github.py` — App authentication, token minting, API client
- `web/src/i18n/en.json` — English strings
- `web/src/i18n/fr.json` — French strings
- `supabase/migrations/` — schema migrations
- `infra/` — Terraform
- `buildspec/test.yml`, `buildspec/build-deploy.yml`, `buildspec/terraform.yml` — CI
- `evals/dataset/` — YAML-labeled PRs
- `scripts/register-app.sh` — one-time GitHub App registration

## Appendix C: Document changelog

- 2026-04-20 — initial version (pre-implementation)

This document is updated when architectural decisions change. Small implementation details may drift from the document; open a PR against `DESIGN.md` before or alongside any change that invalidates a section.
