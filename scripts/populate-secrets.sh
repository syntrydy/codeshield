#!/usr/bin/env bash
# populate-secrets.sh — write secret values into AWS Secrets Manager after
# 'terraform apply' has created the placeholder secrets. Reads values from .env.
#
# Usage (from repo root):
#   AWS_REGION=us-east-1 ENVIRONMENT=prod ./scripts/populate-secrets.sh
#
# The script is idempotent — re-running updates the values in place.

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
NAME_PREFIX="code-review-${ENVIRONMENT}"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example and fill in real values."
  exit 1
fi

# Read .env, stripping comments and blank lines
_env_val() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

GITHUB_APP_ID=$(_env_val "GITHUB_APP_ID")
GITHUB_WEBHOOK_SECRET=$(_env_val "GITHUB_WEBHOOK_SECRET")
SUPABASE_SECRET_KEY=$(_env_val "SUPABASE_SECRET_KEY")
SUPABASE_JWT_SECRET=$(_env_val "SUPABASE_JWT_SECRET")
ANTHROPIC_API_KEY=$(_env_val "ANTHROPIC_API_KEY")
LANGSMITH_API_KEY=$(_env_val "LANGSMITH_API_KEY")

# GitHub private key may be a file path or an inline value
GITHUB_PRIVATE_KEY_FILE="${GITHUB_PRIVATE_KEY_FILE:-}"
if [ -n "$GITHUB_PRIVATE_KEY_FILE" ] && [ -f "$GITHUB_PRIVATE_KEY_FILE" ]; then
  GITHUB_PRIVATE_KEY=$(cat "$GITHUB_PRIVATE_KEY_FILE")
else
  GITHUB_PRIVATE_KEY=$(_env_val "GITHUB_PRIVATE_KEY")
fi

_put() {
  local name="$1"
  local value="$2"
  local secret_id="${NAME_PREFIX}/${name}"
  if [ -z "$value" ]; then
    echo "  SKIP  $secret_id (no value in $ENV_FILE)"
    return
  fi
  aws secretsmanager put-secret-value \
    --secret-id "$secret_id" \
    --secret-string "$value" \
    --region "$AWS_REGION" \
    --output text --query 'VersionId' > /dev/null
  echo "  OK    $secret_id"
}

echo "Populating secrets for prefix: $NAME_PREFIX"
echo

_put "github_app_id"            "$GITHUB_APP_ID"
_put "github_private_key"       "$GITHUB_PRIVATE_KEY"
_put "github_webhook_secret"    "$GITHUB_WEBHOOK_SECRET"
_put "supabase_service_role_key" "$SUPABASE_SECRET_KEY"
_put "supabase_jwt_secret"      "$SUPABASE_JWT_SECRET"
_put "anthropic_api_key"        "$ANTHROPIC_API_KEY"
_put "langsmith_api_key"        "$LANGSMITH_API_KEY"

echo
echo "Done. ECS tasks will pick up new values on next deployment."
echo "Force a rolling restart now:"
echo
echo "  aws ecs update-service --cluster ${NAME_PREFIX}-cluster \\"
echo "    --service ${NAME_PREFIX}-api --force-new-deployment --region $AWS_REGION"
echo "  aws ecs update-service --cluster ${NAME_PREFIX}-cluster \\"
echo "    --service ${NAME_PREFIX}-worker --force-new-deployment --region $AWS_REGION"
