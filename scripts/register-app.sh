#!/usr/bin/env bash
# Register the CodeShield GitHub App using the manifest flow.
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated: gh auth login
#   - jq installed
#   - AWS CLI configured with a profile that has Secrets Manager write access
#
# Usage:
#   ./scripts/register-app.sh [--org <github-org>]
#
# What this does:
#   1. Creates the GitHub App in your personal account (or --org if specified)
#   2. Saves the app ID, webhook secret, and private key to AWS Secrets Manager
#   3. Prints the App slug to add to your .env
#
# After running:
#   - Set GITHUB_APP_ID and GITHUB_APP_SLUG in your .env
#   - The private key and webhook secret are in Secrets Manager under
#     code-review-prod/github_private_key and code-review-prod/github_webhook_secret

set -euo pipefail

ORG=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --org) ORG="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

AWS_REGION="${AWS_REGION:-us-east-1}"
SECRET_PREFIX="${SECRET_PREFIX:-code-review-prod}"

echo "── CodeShield GitHub App registration ──────────────────────────"

# Generate a random webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Build the App manifest
MANIFEST=$(cat <<EOF
{
  "name": "CodeShield AI Reviewer",
  "url": "https://github.com/apps/codeshield-ai-reviewer",
  "hook_attributes": {
    "url": "https://api.your-domain.com/webhooks/github",
    "active": true
  },
  "redirect_url": "https://api.your-domain.com/integrations/github/install-callback",
  "public": false,
  "default_permissions": {
    "contents": "read",
    "pull_requests": "read",
    "checks": "write",
    "metadata": "read"
  },
  "default_events": ["pull_request", "installation", "installation_repositories"]
}
EOF
)

echo "Creating GitHub App via manifest flow..."

if [[ -n "$ORG" ]]; then
  TARGET_FLAG="--owner $ORG"
else
  TARGET_FLAG=""
fi

# Use gh api to create the app (requires GitHub CLI ≥ 2.40)
RESPONSE=$(echo "$MANIFEST" | gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  ${TARGET_FLAG} \
  /app-manifests/$(openssl rand -hex 8)/conversions \
  --input - 2>/dev/null || true)

# If the manifest conversion API isn't available, guide the user through the web flow
if [[ -z "$RESPONSE" ]] || ! echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo ""
  echo "Automatic registration unavailable. Complete the web flow instead:"
  echo ""
  echo "  1. Go to: https://github.com/settings/apps/new"
  if [[ -n "$ORG" ]]; then
    echo "     Or for the org: https://github.com/organizations/$ORG/settings/apps/new"
  fi
  echo "  2. Use these settings:"
  echo "     Name:             CodeShield AI Reviewer"
  echo "     Webhook URL:      https://api.your-domain.com/webhooks/github"
  echo "     Webhook Secret:   $WEBHOOK_SECRET"
  echo "     Permissions:      Contents=Read, Pull Requests=Read, Checks=Write, Metadata=Read"
  echo "     Events:           pull_request, installation, installation_repositories"
  echo "  3. After creation, download the private key (.pem) from the App settings page."
  echo "  4. Run the commands below to store secrets in AWS Secrets Manager:"
  echo ""
  echo "  APP_ID=<your-app-id>"
  echo "  APP_SLUG=<your-app-slug>"
  echo ""
  echo "  aws secretsmanager put-secret-value \\"
  echo "    --region $AWS_REGION \\"
  echo "    --secret-id $SECRET_PREFIX/github_app_id \\"
  echo "    --secret-string \"\$APP_ID\""
  echo ""
  echo "  aws secretsmanager put-secret-value \\"
  echo "    --region $AWS_REGION \\"
  echo "    --secret-id $SECRET_PREFIX/github_webhook_secret \\"
  echo "    --secret-string '$WEBHOOK_SECRET'"
  echo ""
  echo "  aws secretsmanager put-secret-value \\"
  echo "    --region $AWS_REGION \\"
  echo "    --secret-id $SECRET_PREFIX/github_private_key \\"
  echo "    --secret-string file://path/to/downloaded.pem"
  echo ""
  echo "  echo \"GITHUB_APP_ID=\$APP_ID\" >> .env"
  echo "  echo \"GITHUB_APP_SLUG=\$APP_SLUG\" >> .env"
  exit 0
fi

APP_ID=$(echo "$RESPONSE" | jq -r '.id')
APP_SLUG=$(echo "$RESPONSE" | jq -r '.slug')
PEM=$(echo "$RESPONSE" | jq -r '.pem')
CLIENT_ID=$(echo "$RESPONSE" | jq -r '.client_id')

echo "App created: ID=$APP_ID  slug=$APP_SLUG"

echo "Storing secrets in AWS Secrets Manager (region=$AWS_REGION)..."

aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$SECRET_PREFIX/github_app_id" \
  --secret-string "$APP_ID" \
  --output text --query 'Name' > /dev/null

aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$SECRET_PREFIX/github_webhook_secret" \
  --secret-string "$WEBHOOK_SECRET" \
  --output text --query 'Name' > /dev/null

aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$SECRET_PREFIX/github_private_key" \
  --secret-string "$PEM" \
  --output text --query 'Name' > /dev/null

echo ""
echo "── Done ──────────────────────────────────────────────────────────"
echo "Add to your .env:"
echo "  GITHUB_APP_ID=$APP_ID"
echo "  GITHUB_APP_SLUG=$APP_SLUG"
echo ""
echo "Secrets written to Secrets Manager:"
echo "  $SECRET_PREFIX/github_app_id"
echo "  $SECRET_PREFIX/github_webhook_secret"
echo "  $SECRET_PREFIX/github_private_key"
echo ""
echo "Next: run 'make infra-apply' to deploy, then install the App at:"
echo "  https://github.com/apps/$APP_SLUG/installations/new"
