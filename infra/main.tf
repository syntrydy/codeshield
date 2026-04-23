terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Values injected at init time via -backend-config flags in buildspec/terraform.yml
    # bucket         = var.tf_state_bucket
    # key            = var.tf_state_key
    # region         = var.aws_region
    # dynamodb_table = var.tf_lock_table
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Container registry ─────────────────────────────────────────────────────────
module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix
}

# ── Secrets Manager (populated by scripts/populate-secrets.sh after first apply)
module "secrets" {
  source = "./modules/secrets"

  name_prefix = local.name_prefix
}

# ── DynamoDB cache (installation token cache + webhook idempotency) ────────────
module "dynamo_cache" {
  source = "./modules/dynamo_cache"

  name_prefix = local.name_prefix
}

# ── SQS review queue ───────────────────────────────────────────────────────────
module "sqs" {
  source = "./modules/sqs"

  name_prefix = local.name_prefix
}

# ── Lambda worker (container image, triggered by SQS) ─────────────────────────
module "lambda" {
  source = "./modules/lambda"

  name_prefix        = local.name_prefix
  image_uri          = "${module.ecr.api_repo_url}:${var.image_tag}"
  sqs_queue_arn      = module.sqs.queue_arn
  sqs_queue_url      = module.sqs.queue_url
  secrets_prefix     = local.name_prefix
  supabase_url       = var.supabase_url
  supabase_anon_key  = var.supabase_anon_key
  aws_region         = var.aws_region
  cache_table_name   = module.dynamo_cache.table_name
  cache_table_arn    = module.dynamo_cache.table_arn
}

# ── App Runner API service ─────────────────────────────────────────────────────
module "apprunner" {
  source = "./modules/apprunner"

  name_prefix        = local.name_prefix
  image_uri          = "${module.ecr.api_repo_url}:${var.image_tag}"
  aws_region         = var.aws_region
  secrets_prefix     = local.name_prefix
  sqs_queue_url      = module.sqs.queue_url
  supabase_url       = var.supabase_url
  supabase_anon_key  = var.supabase_anon_key
  cache_table_name   = module.dynamo_cache.table_name
  cache_table_arn    = module.dynamo_cache.table_arn
  secret_arns        = module.secrets.secret_arns
  cloudfront_domain  = module.cloudfront.cloudfront_domain
}

# ── S3 buckets ─────────────────────────────────────────────────────────────────
module "s3" {
  source = "./modules/s3"

  name_prefix = local.name_prefix
  environment = var.environment
}

# ── CloudFront + S3 frontend ───────────────────────────────────────────────────
module "cloudfront" {
  source = "./modules/cloudfront"

  name_prefix     = local.name_prefix
  certificate_arn = var.cloudfront_certificate_arn
  domain          = var.cloudfront_domain
}

locals {
  name_prefix = "code-review-${var.environment}"
}

# ── CodeStar connection to GitHub ─────────────────────────────────────────────
# Created in PENDING state. A human must approve it once in the AWS console:
#   Developer Tools → Settings → Connections → click the PENDING connection →
#   Update pending connection → authorize GitHub.
# Re-runs of terraform are idempotent after approval.
resource "aws_codestarconnections_connection" "github" {
  name          = "${local.name_prefix}-github"
  provider_type = "GitHub"
}

# CodeBuild source credential for GitHub — points to the CodeStar connection.
# Region-scoped: one GitHub source credential per region, shared by all CodeBuild projects.
resource "aws_codebuild_source_credential" "github" {
  auth_type   = "CODECONNECTIONS"
  server_type = "GITHUB"
  token       = aws_codestarconnections_connection.github.arn
}

# Account ID for CodeBuild env vars
data "aws_caller_identity" "current" {}

# ── CodeBuild CI/CD ───────────────────────────────────────────────────────────
module "codebuild" {
  source = "./modules/codebuild"

  name_prefix              = local.name_prefix
  aws_region               = var.aws_region
  aws_account_id           = data.aws_caller_identity.current.account_id
  github_repo_url          = var.github_repo_url
  codestar_connection_arn  = aws_codestarconnections_connection.github.arn

  tf_state_bucket = var.tf_state_bucket
  tf_state_key    = var.tf_state_key
  tf_lock_table   = var.tf_lock_table

  ecr_repo_name              = "${local.name_prefix}-api"
  lambda_function_name       = module.lambda.function_name
  apprunner_service_arn      = module.apprunner.service_arn
  frontend_bucket            = module.cloudfront.frontend_bucket_name
  cloudfront_distribution_id = module.cloudfront.distribution_id
  api_health_url             = "https://${module.apprunner.service_url}"

  vite_supabase_url             = var.supabase_url
  vite_supabase_publishable_key = var.supabase_anon_key
  vite_api_base_url             = "https://${module.apprunner.service_url}"
  vite_github_app_slug          = var.github_app_slug

  supabase_url             = var.supabase_url
  supabase_publishable_key = var.supabase_anon_key

  secrets_prefix = local.name_prefix

  depends_on = [aws_codebuild_source_credential.github]
}
