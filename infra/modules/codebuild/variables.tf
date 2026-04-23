variable "name_prefix"      { type = string }
variable "aws_region"       { type = string }
variable "aws_account_id"   { type = string }

# GitHub source
variable "github_repo_url" {
  type        = string
  description = "Full GitHub repo URL (e.g. https://github.com/syntrydy/codeshield.git)"
}

variable "codestar_connection_arn" {
  type        = string
  description = "ARN of the CodeStar connection used for GitHub source auth"
}

# Terraform backend (passed into buildspec/terraform.yml)
variable "tf_state_bucket" { type = string }
variable "tf_state_key"    { type = string }
variable "tf_lock_table"   { type = string }

# build-deploy runtime env
variable "ecr_repo_name"             { type = string }
variable "lambda_function_name"      { type = string }
variable "apprunner_service_arn"     { type = string }
variable "frontend_bucket"           { type = string }
variable "cloudfront_distribution_id" { type = string }
variable "api_health_url"            { type = string }

# VITE build-time env vars for frontend bundle
variable "vite_supabase_url"             { type = string }
variable "vite_supabase_publishable_key" { type = string }
variable "vite_api_base_url"             { type = string }
variable "vite_github_app_slug"          { type = string }

# Non-secret env vars needed at Python import time
variable "supabase_url"             { type = string }
variable "supabase_publishable_key" { type = string }

# Secrets Manager prefix (for `secrets-manager:` references in buildspecs)
variable "secrets_prefix" { type = string }
