.PHONY: up down logs test web-dev db-push db-reset

# Bring up the full local stack (API + worker + Redis)
up:
	docker compose up --build -d

# Stop and remove containers
down:
	docker compose down

# Tail logs for all services
logs:
	docker compose logs -f

# Run backend tests
test:
	cd api && uv run pytest -xvs

# Start the frontend dev server
web-dev:
	cd web && pnpm dev

# Push Supabase migrations to the hosted project
db-push:
	supabase db push

# Reset the local/hosted DB and re-run all migrations (destructive — dev only)
db-reset:
	supabase db reset
