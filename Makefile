.PHONY: up down logs test lint type-check eval web-dev web-build frontend-deploy db-push db-reset infra-setup infra-init infra-plan infra-apply secrets ecr-seed

# ── Terraform state backend defaults (override on the command line if needed) ──
TF_STATE_BUCKET ?= codeshield-tf-state
TF_STATE_KEY    ?= codeshield/prod/terraform.tfstate
TF_LOCK_TABLE   ?= codeshield-tf-locks
AWS_REGION      ?= us-east-1

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

# Build + deploy frontend to S3 + invalidate CloudFront cache
frontend-deploy:
	$(eval API_URL    := $(shell cd infra && terraform output -raw api_url))
	$(eval FRONTEND_BUCKET := $(shell cd infra && terraform output -raw frontend_bucket))
	$(eval CF_DIST_ID := $(shell cd infra && terraform output -raw cloudfront_distribution_id))
	cd web && \
	  VITE_API_BASE_URL=$(API_URL) \
	  VITE_SUPABASE_URL=$(shell grep '^VITE_SUPABASE_URL=' .env | cut -d= -f2-) \
	  VITE_SUPABASE_PUBLISHABLE_KEY=$(shell grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2-) \
	  VITE_GITHUB_APP_SLUG=$(shell grep '^VITE_GITHUB_APP_SLUG=' .env | cut -d= -f2-) \
	  pnpm build
	aws s3 sync web/dist/assets/ s3://$(FRONTEND_BUCKET)/assets/ \
	  --delete --cache-control "public,max-age=31536000,immutable" --region $(AWS_REGION)
	aws s3 sync web/dist/ s3://$(FRONTEND_BUCKET)/ \
	  --delete --exclude "assets/*" --cache-control "no-cache,no-store,must-revalidate" --region $(AWS_REGION)
	aws cloudfront create-invalidation \
	  --distribution-id $(CF_DIST_ID) --paths "/*" --region $(AWS_REGION)

# ── Database ──────────────────────────────────────────────────────────────────

# Push Supabase migrations to the hosted project
db-push:
	supabase db push

# Reset the LINKED hosted DB (drops schema, re-runs all migrations,
# WIPES auth.users). The CLI prompts for a typed 'y' before proceeding.
# Run 'supabase link --project-ref <ref>' once if not already linked.
db-reset:
	supabase db reset --linked

# ── Infrastructure ────────────────────────────────────────────────────────────

# First-time deploy: bootstrap state backend + init + apply (idempotent).
# Order matters: ECR + Secrets created first, image pushed, secrets populated,
# then App Runner + Lambda created (both need the image and populated secrets).
infra-setup:
	AWS_REGION=$(AWS_REGION) TF_STATE_BUCKET=$(TF_STATE_BUCKET) TF_LOCK_TABLE=$(TF_LOCK_TABLE) \
		./scripts/bootstrap-infra.sh
	$(MAKE) infra-init
	cd infra && terraform apply -auto-approve \
		-target=module.ecr \
		-target=module.secrets \
		-target=module.sqs \
		-target=module.dynamo_cache \
		-target=module.s3 \
		-target=module.cloudfront
	$(MAKE) ecr-seed
	$(MAKE) secrets
	cd infra && terraform apply -auto-approve

# Build the API image and push it to ECR (required before App Runner + Lambda can be created)
ecr-seed:
	$(eval ECR_REPO := $(shell cd infra && terraform output -raw api_ecr_repo_url))
	$(eval ECR_HOST := $(shell cd infra && terraform output -raw api_ecr_repo_url | cut -d/ -f1))
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ECR_HOST)
	docker build -t $(ECR_REPO):latest ./api
	docker push $(ECR_REPO):latest

# Populate secrets from .env into Secrets Manager (run once after infra-setup)
secrets:
	./scripts/populate-secrets.sh

# Initialise Terraform backend
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
