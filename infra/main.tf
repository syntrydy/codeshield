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

# ── Redis Serverless (installation token cache) ────────────────────────────────
module "redis" {
  source = "./modules/redis_serverless"

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

  name_prefix       = local.name_prefix
  image_uri         = "${module.ecr.api_repo_url}:${var.image_tag}"
  sqs_queue_arn     = module.sqs.queue_arn
  sqs_queue_url     = module.sqs.queue_url
  secrets_prefix    = local.name_prefix
  supabase_url      = var.supabase_url
  supabase_anon_key = var.supabase_anon_key
  aws_region        = var.aws_region
}

# ── App Runner API service ─────────────────────────────────────────────────────
module "apprunner" {
  source = "./modules/apprunner"

  name_prefix       = local.name_prefix
  image_uri         = "${module.ecr.api_repo_url}:${var.image_tag}"
  aws_region        = var.aws_region
  secrets_prefix    = local.name_prefix
  sqs_queue_url     = module.sqs.queue_url
  supabase_url      = var.supabase_url
  supabase_anon_key = var.supabase_anon_key
  redis_url         = module.redis.redis_url
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
