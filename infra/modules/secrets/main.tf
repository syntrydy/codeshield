variable "name_prefix" { type = string }

locals {
  secret_names = [
    "github_app_id",
    "github_app_slug",
    "github_private_key",
    "github_webhook_secret",
    "supabase_service_role_key",
    "openai_api_key",
    "anthropic_api_key",
    "langsmith_api_key",
  ]
}

resource "aws_secretsmanager_secret" "secrets" {
  for_each = toset(local.secret_names)

  name = "${var.name_prefix}/${each.key}"
  # Secrets are populated manually after first apply (or via a separate rotation runbook)
  # Deliberately not setting secret_string here — placeholder only.

  tags = { Name = "${var.name_prefix}-${each.key}" }
}

output "secret_arns" {
  description = "Map of secret name → ARN, injected into ECS task definitions as env vars"
  value       = { for k, s in aws_secretsmanager_secret.secrets : upper(k) => s.arn }
}
