.PHONY: up down logs test lint type-check eval web-dev db-push db-reset infra-init infra-plan infra-apply

# ── Local dev stack ───────────────────────────────────────────────────────────

# Bring up the full local stack (API + worker + Redis + Vite dev server)
up:
	docker compose up --build -d

# Stop and remove containers
down:
	docker compose down

# Tail logs for all services (ctrl-c to stop)
logs:
	docker compose logs -f

# ── Backend ───────────────────────────────────────────────────────────────────

# Run backend tests
test:
	cd api && uv run pytest -xvs

# Lint and format check (ruff)
lint:
	cd api && uv run ruff check .

# Static type check (mypy)
type-check:
	cd api && uv run mypy app

# Run the fast eval subset (3 fixtures — mirrors the CI gate)
eval:
	cd api && PYTHONPATH=../api uv run python -m evals.run --subset=fast

# Run the full eval suite
eval-full:
	cd api && PYTHONPATH=../api uv run python -m evals.run

# ── Frontend ──────────────────────────────────────────────────────────────────

# Start the frontend Vite dev server (outside Docker, for hot reload)
web-dev:
	cd web && pnpm dev

# Type-check the frontend
web-type-check:
	cd web && pnpm exec tsc --noEmit

# Production build
web-build:
	cd web && pnpm build

# ── Database ──────────────────────────────────────────────────────────────────

# Push Supabase migrations to the hosted project
db-push:
	supabase db push

# Reset the local/hosted DB and re-run all migrations (destructive — dev only)
db-reset:
	supabase db reset

# ── Infrastructure ────────────────────────────────────────────────────────────

# Initialise Terraform (requires TF_STATE_BUCKET, TF_STATE_KEY, TF_LOCK_TABLE, AWS_REGION)
infra-init:
	cd infra && terraform init \
		-backend-config="bucket=$(TF_STATE_BUCKET)" \
		-backend-config="key=$(TF_STATE_KEY)" \
		-backend-config="region=$(AWS_REGION)" \
		-backend-config="dynamodb_table=$(TF_LOCK_TABLE)"

# Preview infrastructure changes
infra-plan:
	cd infra && terraform plan

# Apply infrastructure changes
infra-apply:
	cd infra && terraform apply
