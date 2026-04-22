# CLAUDE.md

This file is read at the start of every Claude Code session. It encodes decisions already made for this project. Do not re-litigate them. If something here blocks a task, surface the conflict to me before proceeding — don't silently work around it.

**This file is the enforcement layer (short, rules-only). For the full context — why decisions were made, data model details, flow diagrams, event taxonomies, error handling matrices, and the v2 roadmap — consult `DESIGN.md` at the repo root.** When starting a task that touches architecture (graph state, data model, webhook contract, GitHub App flow, i18n, RLS), read the relevant section of `DESIGN.md` first.

## What this project is

An AI code review agent. A developer installs our GitHub App on a repo; every opened or updated pull request triggers a multi-specialist review that posts back as a GitHub Check Run. Four specialists (Security, Correctness, Performance, Style) run in parallel, each with tool access to the repo. Findings aggregate into a structured review.

The goal is a portfolio project demonstrating production-grade AI engineering: observability, evals, prompt management, and real integration — not a demo script.

## Stack (locked — do not propose alternatives)

**Backend:** Python 3.12, FastAPI, LangGraph, LangChain Anthropic, Pydantic v2, `uv` for package management. Background tasks dispatched via AWS SQS and executed by a Lambda container worker (`TASK_BACKEND=local` uses a daemon thread for local dev).

**Frontend:** React 18, TypeScript, Vite, shadcn/ui components (copy-in, not npm), TanStack Query, `react-hook-form` + Zod, Tailwind CSS, `react-i18next` + `i18next-browser-languagedetector` for i18n.

**Data & Auth:** Supabase hosted — Postgres with pgvector, Supabase Auth (GitHub OAuth for user sign-in), Supabase Realtime for event streaming. Row-Level Security on all user-facing tables.

**LLM & Observability:** Anthropic Claude only. Sonnet for reasoning, Haiku for routing/classification. LangSmith for traces, prompts (Hub), and evals. No other LLM providers, no model router.

**Infra:** AWS — App Runner (API service, pay-per-request), SQS (review queue), Lambda (worker, pay-per-invocation), ElastiCache Serverless (installation token cache, pay-per-use), S3, Secrets Manager, ECR, CloudWatch, CloudFront + S3 (frontend). Terraform with remote state in S3 + DynamoDB lock. No VPC, no ALB, no always-on worker.

**CI/CD:** AWS CodeBuild. Three projects: test, build-deploy, terraform. Triggered by GitHub webhooks.

## Architectural rules (non-negotiable)

1. **Prompts live in LangSmith Hub.** Never hardcode specialist prompts in Python. Pull at worker boot, cache in memory, with a bundled fallback for LangSmith outages.

2. **Workers write to Supabase with the service-role client; browsers read with the anon key + user JWT.** Never pass service-role keys to the browser. Never bypass RLS in user-facing endpoints.

3. **Agent progress streams via Supabase Realtime.** Workers insert rows into `run_events`; the browser subscribes via `postgres_changes`. No SSE endpoints. No WebSocket gateway. No Redis pub/sub for user-facing events (Redis/ElastiCache is the installation token cache only).

4. **All API endpoints verify user identity via the `current_user_id` FastAPI dependency** (decodes Supabase JWT with HS256 + project JWT secret). Webhook endpoints are the ONE exception — they verify via GitHub HMAC signature, not user JWT.

5. **GitHub App acts via installation tokens, not OAuth tokens.** Mint on-demand by signing a JWT with the App private key and exchanging for a 1-hour token. Cache in Redis with 55-minute TTL, keyed by `installation_id`. Never persist installation tokens in Postgres.

6. **The GitHub App private key lives in AWS Secrets Manager.** Never in `.env`, never in Supabase, never committed. Lambda bootstraps secrets from Secrets Manager on cold start via its IAM execution role; App Runner reads them via its instance role.

7. **Webhooks are idempotent.** The `X-GitHub-Delivery` header is the idempotency key; store seen IDs in Redis with 24h TTL. Webhook endpoints return 2xx within 10 seconds or GitHub retries.

8. **Graph nodes never silently swallow exceptions.** Every specialist node has try/except that (a) logs to LangSmith, (b) emits a `{specialist}.failed` event to `run_events`, (c) returns an empty findings list so the aggregator keeps working. Letting one specialist kill the whole run is a bug.

9. **Parallel fan-out uses LangGraph `Send`.** The `findings` field in state is `Annotated[list[dict], operator.add]` so reducers concatenate across branches. A non-reducer list field will silently lose findings — don't change the type.

10. **Anthropic calls are rate-limited by an `asyncio.Semaphore(4)` at the client wrapper level.** Do not remove this, even "temporarily for testing."

11. **All user-facing strings go through `t('key')` from `react-i18next` — no exceptions.** Supported locales are `en` (default) and `fr`. Every new key is added to BOTH `web/src/i18n/en.json` AND `web/src/i18n/fr.json` in the same commit. Missing keys on either side are a bug. Technical terms (`pull request`, `commit`, `webhook`, `Check Run`) stay in English in both files — do not translate them.

12. **Locale flows through the LangGraph.** `ReviewState` has a `locale: Literal["en", "fr"]` field. Specialist prompts in LangSmith Hub include `{locale}` in the system message. Severity enums stored in the DB are always English (`low`, `medium`, etc.) and translated at display time. The project's `review_output_locale` column governs Check Run output language; the user's UI locale governs dashboard display.

## Anti-patterns (do not do these)

- **No `localStorage` / `sessionStorage`** in any frontend code outside of session-management helpers Supabase itself provides.
- **No `print()` for logging.** Use the standard `logging` module with a structured formatter. `print()` is for REPL exploration only.
- **No silent `except Exception: pass`.** Either handle the specific exception meaningfully, emit a failure event, or re-raise.
- **No committing `.env`, `.pem`, or anything under `secrets/`.** `.gitignore` enforces this; don't override.
- **No OpenAI, Gemini, Mistral, or model-router packages** — with one approved exception: `langchain-openai` is permitted as a `.with_fallbacks()` fallback on the Anthropic client to handle 429 rate-limit errors. It must never be used as a primary LLM and may not be added as a dependency for any other purpose.
- **No `any` in TypeScript** except at library boundaries where the upstream types are broken. Annotate those with `// library-boundary: <reason>`.
- **No SSE, no custom WebSocket server.** Supabase Realtime is the streaming layer.
- **No hardcoded prompts in graph nodes.** Even stubs for Day 1 should pull from LangSmith Hub (seed the Hub with placeholders on Day 1).
- **No hardcoded user-facing strings in components.** Every string visible to a user goes through `t('key')`. "Temporary" hardcoded strings accumulate and become Day-8 pain.
- **No translating technical terms.** `pull request`, `commit`, `branch`, `webhook`, `Check Run`, `repository` stay in English in both `en.json` and `fr.json`. The francophone dev community uses the English forms.
- **No storing translated severity or status enums in the DB.** Store English canonical values (`low`, `critical`, `queued`, `running`); translate on render.
- **No Postgres triggers or stored procedures for application logic.** All business logic lives in Python. Triggers are for invariants (updated_at), not workflow.
- **No task chaining.** One SQS message → one Lambda invocation → one `run_review` call. Orchestration happens inside the LangGraph, not in the dispatch layer.

## Project structure

```
api/            Python backend (FastAPI + LangGraph)
  app/
    core/       config, supabase clients, auth, github app
    api/        FastAPI routes (user-facing)
    webhooks/   FastAPI routes (GitHub webhooks — separate namespace)
    graph/      LangGraph state, nodes, graph assembly, tools
    worker/     dispatch.py, tasks.py (run_review), lambda_handler.py
  tests/
web/            React + TypeScript + shadcn frontend
supabase/       migrations/, config.toml
infra/          Terraform (modules: ecr, secrets, sqs, lambda, apprunner, redis_serverless, s3, cloudfront)
buildspec/      CodeBuild YAMLs (test, build-deploy, terraform)
.github/        issue and PR templates (not CI — CI is CodeBuild)
CLAUDE.md       this file
README.md       public-facing, architecture, setup, v2 roadmap
```

## Style and conventions

- **Python:** type hints everywhere, Pydantic v2 for all request/response/event schemas, `ruff` for lint + format. Line length 100. No docstrings on obvious functions; docstrings on graph nodes and tools.
- **TypeScript:** strict mode on. Prefer `type` over `interface` unless extending. Zod schemas for all API IO. Component props typed inline (no separate `interface Props`).
- **SQL:** snake_case, plural table names, `uuid` primary keys except where `bigserial` makes sense (events, webhook deliveries).
- **Commits:** small and working. Conventional Commits format (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). One logical change per commit.
- **Tests:** pytest for backend, Vitest for frontend (if needed). Mock at the boundary — fake `ChatAnthropic`, fake Supabase client, fake GitHub API. Do not mock internal functions.

## Verification expectations

**Before claiming a task is done, Claude Code must:**

1. Run the relevant test command (`make test` or `cd api && uv run pytest -xvs <specific_test>`) and show the actual output — not summarize it.
2. For schema changes: show the output of `supabase db push` or the migration SQL applied.
3. For endpoints: `curl` the endpoint and show the actual response, not a predicted one.
4. For UI: state explicitly that the user needs to verify visually — do not claim UI works without human confirmation.
5. For webhooks: show a real delivery going through smee.io and the resulting log line — do not claim webhook handling works based on unit tests alone.

If a verification step was skipped, say so explicitly. "I wrote the code but haven't run the tests" is the correct, honest report. "Tests pass" without having run them is a bug.

## Task sizing

I work one micro-task at a time. A micro-task is:
- One file created, or
- One function/component added to an existing file, or
- One bug fixed, or
- One migration written.

Not: "implement the webhook handler." That is 5–8 micro-tasks. Break it down before starting, confirm the breakdown with me, then execute one at a time.

After each micro-task: show the diff, run verification, commit. Then wait for my next instruction. Do not chain micro-tasks without checking in.

## Out of scope for v1 (do not build these)

- Branch-filter UI (v1 defaults to reviewing PRs against the default branch + any branch with an open PR; setting lives in the DB but has no UI).
- Posting reviews as PR comments (v1 uses Check Runs only).
- Multi-user / team permissions per project (v1 assumes installation owner == project owner).
- Model router / multi-provider fallback.
- Webhook secret rotation UI.
- Running on self-hosted GitHub Enterprise.
- Non-English review output.

If a task drifts toward these, stop and confirm scope.

## Reference docs (authoritative over model memory)

When working on these areas, open the current docs — do not rely on training-data priors:

- **GitHub App authentication and webhooks:** https://docs.github.com/en/apps
- **Check Runs API:** https://docs.github.com/en/rest/checks
- **Supabase RLS:** https://supabase.com/docs/guides/database/postgres/row-level-security
- **Supabase Realtime postgres_changes:** https://supabase.com/docs/guides/realtime/postgres-changes
- **LangGraph state + Send:** https://langchain-ai.github.io/langgraph/
- **LangSmith Hub:** https://docs.smith.langchain.com/prompt_engineering/how_to_guides/manage_prompts_programatically

## Day-by-day status

Claude Code should update this section at the end of each working session with what was completed, what was attempted but didn't work, and what's next. Keep it honest.

- **Day 1:** Complete. FastAPI app, pydantic-settings config, `current_user_id` JWT auth dependency, GitHub App token minting with Redis cache, webhook HMAC verification, Supabase schema migration (7 tables, RLS, indexes).

- **Day 2:** Complete. Full GitHub webhook handler (HMAC → idempotency → project lookup → run insert → Celery dispatch). Installation callback (`/integrations/github/install-callback`) upserts installations and projects. Webhook tests cover 202, idempotency, bad signature, and installation events.

- **Day 3:** Complete. LangGraph review pipeline: `ReviewState` TypedDict with `Annotated[list, add]` reducers for parallel fan-out safety, planner node, `safe_specialist` factory with full error isolation, aggregator stub, `_route_to_specialists` conditional edge emitting `Send(f"specialist_{s}", state)` per enabled specialist. Graph compiles and all nodes tested.

- **Day 4:** Complete. Celery task (`review_pr`) wrapping full graph invocation. FastAPI routes: `GET/PATCH /projects`, `GET /projects/{id}/runs`, `GET /runs/{id}` (with findings + events). LangSmith prompt Hub integration with `@lru_cache` and bundled fallbacks. All 33 API + graph tests passing.

- **Day 5:** Complete. React frontend: `AuthContext` + `useAuth` (Supabase GitHub OAuth), `ProtectedRoute`, `SignInPage`, `DashboardPage`, `RunsPage`, `RunDetailPage`, `App.tsx` router wiring. TanStack Query client, typed `apiFetch` helpers. Full i18n key set in `en.json` and `fr.json`. TypeScript strict mode, Vite production build passing.

- **Day 6:** Complete. GitHub Check Run lifecycle (queued → in_progress → completed/failure) via `create_check_run` / `update_check_run` helpers with annotation pagination. Token accumulator fields (`total_input_tokens`, `total_output_tokens`) added to `ReviewState` with `add` reducers. Cost estimation in task. `conftest.py` stub env vars fix pre-existing test isolation issue (all 41 tests pass). `useRunEvents` Supabase Realtime hook in `RunDetailPage` for live event streaming.

- **Day 7:** Complete. `web/Dockerfile` (nginx multi-stage) + `nginx.conf` (SPA fallback). `docker-compose.yml` updated with Vite dev web service. `buildspec/build-deploy.yml` implemented (ECR push + ECS rolling deploy + smoke test). `buildspec/terraform.yml` implemented (plan on PR, apply on main). Two eval fixtures (SQL injection, null dereference). `evals/run.py` runner with recall/precision/FP/verdict scoring and CI gates. Terraform skeleton: `main.tf`, `variables.tf`, `outputs.tf`, 6 modules (VPC, ECR, Redis, ALB, ECS, Secrets, S3) — `terraform validate` passes.

- **Day 8:** Complete. Makefile expanded (eval, lint, type-check, infra targets). `scripts/register-app.sh` for one-time GitHub App registration. All pre-existing ruff lint errors fixed (41 tests still passing). Install success banner on DashboardPage (`?installed=1`). README expanded with GitHub App setup, CI/CD wiring, infra, eval, and project structure sections. Duplicate root-level buildspec files removed.

- **Post Day-8 wiring session:** Complete. Full LLM pipeline wired end-to-end:
  - `api/app/graph/tools.py` — 5 `@tool` functions (`get_pr_metadata`, `get_changed_files`, `get_file_content`, `get_diff`, `get_adjacent_code`) with `contextvars` credential threading via `set_github_context()`.
  - `api/app/graph/state.py` — added `github_installation_id`, `repo_full_name`, `severity_threshold` fields.
  - `api/app/graph/nodes.py` — replaced all stubs with real Claude Sonnet calls: `planner_node` (JSON plan parse with fallback), `_run_specialist` (ReAct loop, 6-iteration cap, tool binding), `aggregator_node` (dedup/verdict).
  - `api/app/worker/tasks.py` — passes all three new fields into initial `ReviewState`; fetches `severity_threshold` from Supabase *before* graph invocation.
  - `api/app/graph/prompts.py` + `api/scripts/seed_prompts.py` — production-quality prompts for all 6 agents with locale, severity threshold, and JSON output format instructions.
  - 22 new tests (tools + nodes), all mocked at boundary. Suite: 63 tests passing.

- **Scoring gap session:** Complete. Closed all high-impact rubric gaps:
  - Eval dataset expanded from 2 → 15 YAML fixtures covering all 4 specialists.
  - Latency instrumentation: `duration_ms` on all three graph nodes + HTTP middleware in `main.py`.
  - Worker test coverage: 10 tests for `run_review` in `test_review_task.py` (was zero).
  - Prompts upgraded to deliberate few-shot: positive example + false-positive guard per specialist.
  - Token breakdown surfaced in `RunDetailPage` (input/output counts + cost).
  - UI pages added: `ProjectsPage`, `AllRunsPage`, `GitHubCallbackPage`, `ProjectEditModal`.
  - i18n keys added for `tokensIn`, `tokensOut` in both `en.json` and `fr.json`.
  - Suite: 74 tests passing.

- **Infrastructure refactor:** Complete. Replaced all always-on paid services with pay-as-you-go:
  - Deleted `celery_app.py`; renamed `review_pr` → `run_review` (plain Python function, no broker).
  - Added `worker/dispatch.py`: `TASK_BACKEND=local` runs a daemon thread, `=sqs` sends to SQS.
  - Added `worker/lambda_handler.py`: bootstraps Secrets Manager on cold start, processes SQS records.
  - Terraform: removed `vpc`, `alb`, `ecs`, `redis` modules; added `apprunner`, `sqs`, `lambda`, `redis_serverless` modules. `terraform validate` passes.
  - `buildspec/build-deploy.yml`: replaces ECS rolling deploy with `lambda update-function-code` + `apprunner start-deployment`.
  - `docker-compose.yml`: worker service removed (Redis kept for local token cache).
  - Suite: 74 tests passing.
