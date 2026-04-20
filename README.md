# CodeShield

An AI code review agent that performs automated, multi-specialist reviews on GitHub pull requests and posts results back as Check Run annotations.

## What it does

A developer installs the GitHub App on a repository. Every opened or updated pull request triggers four parallel specialist agents — Security, Correctness, Performance, and Style — each backed by Anthropic Claude. Findings are aggregated and posted to GitHub as a Check Run with line-level annotations. A dashboard lets project owners view full agent traces, cost breakdowns, and historical runs.

## Stack

| Layer | Technology |
|---|---|
| Backend API + worker | Python 3.12, FastAPI, Celery, LangGraph, LangChain Anthropic |
| Frontend | React 18, TypeScript, Vite, shadcn/ui, TanStack Query, Tailwind CSS |
| Database + auth + realtime | Supabase (Postgres + pgvector, Auth, Realtime) |
| LLM + observability | Anthropic Claude (Sonnet + Haiku), LangSmith |
| Infrastructure | AWS ECS Fargate, ElastiCache Redis, S3, Secrets Manager, ECR |
| IaC | Terraform |
| CI/CD | AWS CodeBuild |

For the full architecture, data model, agent design, and v2 roadmap, see [DESIGN.md](./DESIGN.md).

## Prerequisites

- Docker and Docker Compose
- `uv` — [install](https://docs.astral.sh/uv/getting-started/installation/)
- `pnpm` — `npm install -g pnpm`
- `supabase` CLI — [install](https://supabase.com/docs/guides/cli)
- A Supabase project (create at [supabase.com](https://supabase.com))
- An Anthropic API key
- A LangSmith account and API key

## Setup

1. Clone the repo and copy the environment template:

   ```bash
   cp .env.example .env
   # Edit .env with your Supabase, Anthropic, and LangSmith credentials
   ```

2. Push the database schema to your Supabase project:

   ```bash
   make db-push
   ```

3. Start the local stack:

   ```bash
   make up
   ```

4. In a separate terminal, start the frontend dev server:

   ```bash
   make web-dev
   ```

5. Visit `http://localhost:5173`.

## Running tests

```bash
make test
```

## GitHub App setup

See [DESIGN.md §8](./DESIGN.md) for the App registration steps. The one-time registration script is at `scripts/register-app.sh` (Day 2 work).

## v2 roadmap

See [DESIGN.md §20.2](./DESIGN.md) for the full roadmap: PR comment posting, team accounts, cost budgets, staging environments, and more.
