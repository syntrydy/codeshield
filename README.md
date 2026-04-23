# CodeShield

An AI code review agent that performs automated, multi-specialist reviews on GitHub pull requests and posts results back as Check Run annotations.

## What it does

A developer installs the GitHub App on a repository. Every opened or updated pull request triggers four parallel specialist agents — Security, Correctness, Performance, and Style — each backed by OpenAI `gpt-4o` (with Anthropic Claude as an optional fallback). Findings are aggregated and posted to GitHub as a Check Run with line-level annotations. A dashboard lets project owners view full agent traces, cost breakdowns, and historical runs across all their connected repositories.

## Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.12, FastAPI, LangGraph, LangChain OpenAI, Pydantic v2 |
| Background worker | AWS Lambda (container image) triggered by SQS; background thread locally |
| Frontend | React 18, TypeScript, Vite, shadcn/ui, TanStack Query, Tailwind CSS |
| Database + auth + realtime | Supabase (Postgres + pgvector, Auth, Realtime) |
| LLM + observability | OpenAI `gpt-4o` (primary) + Anthropic Claude Sonnet 4.5 (optional fallback), LangSmith |
| Infrastructure | AWS App Runner (API), SQS, Lambda (worker), ElastiCache Serverless (token cache), CloudFront + S3 (frontend), ECR, Secrets Manager |
| IaC | Terraform |
| CI/CD | AWS CodeBuild (4 projects: test, build-deploy, terraform, eval-nightly) |

For the full architecture, data model, agent design, and v2 roadmap, see [DESIGN.md](./DESIGN.md).

---

## Local development

### Prerequisites

- Docker and Docker Compose
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) for Python package management
- `pnpm` — `npm install -g pnpm`
- [`supabase` CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (create at [supabase.com](https://supabase.com))
- An OpenAI API key (and optionally an Anthropic API key for fallback)
- A LangSmith account and API key

### First-time setup

1. **Clone and configure environment:**

   ```bash
   git clone https://github.com/your-org/codeshield.git
   cd codeshield
   cp .env.example .env
   # Fill in all values in .env
   ```

2. **Push the database schema:**

   ```bash
   make db-push
   ```

3. **Start the full local stack** (API + Redis + Vite dev server):

   ```bash
   make up
   ```

   Or to run the Vite dev server outside Docker (faster hot-reload):

   ```bash
   make up          # starts api + redis
   make web-dev     # starts Vite in a separate terminal
   ```

   Background review jobs run in a daemon thread locally (`TASK_BACKEND=local`, the default). No SQS or Lambda needed for local development.

4. **Visit** `http://localhost:5173` — sign in with GitHub and install the App.

### Common commands

```bash
make test          # run backend tests
make lint          # ruff lint check
make type-check    # mypy static type check
make eval          # fast eval subset (3 fixtures — mirrors CI gate)
make web-build     # production Vite build
make logs          # tail all Docker service logs
make db-push       # apply Supabase migrations
```

---

## GitHub App setup

### Register the App (one-time)

```bash
./scripts/register-app.sh
# Or for a GitHub org:
./scripts/register-app.sh --org your-org
```

This creates the App in your GitHub account and stores the private key and webhook secret in AWS Secrets Manager. After running it, add `GITHUB_APP_ID` and `GITHUB_APP_SLUG` to your `.env`.

If `gh` CLI registration isn't available, the script prints step-by-step manual instructions.

### Receive webhooks locally

Use [smee.io](https://smee.io) to forward GitHub webhook events to your local API:

```bash
npm install -g smee-client
smee --url https://smee.io/<your-channel> --target http://localhost:8000/webhooks/github
```

Point the webhook URL in your GitHub App settings to your smee.io channel.

---

## CI/CD

Four AWS CodeBuild projects in `us-east-1`, provisioned by `infra/modules/codebuild/`:

| Project | Trigger | Action |
|---|---|---|
| `code-review-prod-test` | Any push or PR | `ruff` + `pytest` + `pnpm build` |
| `code-review-prod-build-deploy` | Push to `main` | Build API image → ECR, update Lambda + App Runner, sync frontend to S3, invalidate CloudFront, smoke-test `/health` |
| `code-review-prod-terraform` | Push/PR affecting `infra/**` | `terraform plan` on PRs, `terraform apply -auto-approve` on main |
| `code-review-prod-eval-nightly` | CloudWatch schedule (02:00 UTC daily) | Full eval suite, posts results to LangSmith |

All projects share one IAM role with `AdministratorAccess` (the terraform project needs broad perms; the others ride along). GitHub integration uses an `aws_codestarconnections_connection` that must be approved once in the AWS console after `terraform apply`.

Buildspecs live in `buildspec/`. CodeBuild does not reset the working directory between phases — commands use `$CODEBUILD_SRC_DIR` to stay portable.

**Temporarily dropped from CI** (tech debt): `mypy app` (pre-existing errors), `pnpm lint` (~59 `t('key')` violations), fast eval in `test.yml` (`evals/run.py` builds a `ReviewState` missing fields added during the LLM swap).

---

## Infrastructure

Terraform manages all AWS resources. State is stored in S3 with DynamoDB locking.

```bash
# Initialise (requires TF_STATE_BUCKET, TF_STATE_KEY, TF_LOCK_TABLE, AWS_REGION)
make infra-init

# Preview changes
make infra-plan

# Apply changes
make infra-apply
```

Modules: `ecr`, `secrets`, `sqs`, `lambda`, `apprunner`, `redis_serverless`, `s3`, `cloudfront`. See `infra/` for details.

All services are pay-as-you-go — there are no always-on instances. App Runner scales to zero between requests; Lambda is invoked per PR review; ElastiCache Serverless charges per GB-hour and per request.

---

## Evals

The eval suite measures review quality against a curated dataset of labeled PRs.

```bash
make eval           # fast subset (3 fixtures) — same gate as CI
make eval-full      # full dataset
```

Results are written to `evals/results.json`. The CI gate fails if recall drops below 60% or false-positive rate exceeds 30%.

Dataset format and metrics are documented in [evals/README.md](./evals/README.md).

---

## Project structure

```
api/            Python backend (FastAPI + LangGraph)
  app/
    core/       config, auth, supabase clients, github app, logging
    api/        FastAPI routes (projects, runs, integrations, health)
    webhooks/   GitHub webhook handler
    graph/      LangGraph state, nodes, graph assembly
    worker/     dispatch.py, tasks.py (run_review), lambda_handler.py
  tests/
evals/          Eval dataset, runner, and results
  dataset/      YAML-labeled PR fixtures
infra/          Terraform (root config + modules)
buildspec/      CodeBuild YAMLs (test, build-deploy, terraform)
scripts/        Operational scripts (register-app.sh)
supabase/       migrations/, config.toml
web/            React + TypeScript + shadcn frontend
  src/
    contexts/   AuthContext
    hooks/      useAuth, useRunEvents
    pages/      SignIn, Dashboard, Runs, RunDetail
    lib/        api fetch helpers, queryClient, supabase client
    i18n/       en.json, fr.json
CLAUDE.md       AI assistant instructions (session constitution)
DESIGN.md       Full architecture and design document
```

---

## v2 roadmap

See [DESIGN.md §20.2](./DESIGN.md) for the full roadmap: PR comment posting, team accounts, cost budgets per user, staging environment, model-provider fallback, and more.
