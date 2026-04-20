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

# ── Networking ─────────────────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  name               = local.name_prefix
  availability_zones = var.availability_zones
}

# ── Container registry ─────────────────────────────────────────────────────────
module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix
}

# ── Redis (Celery broker + token cache) ────────────────────────────────────────
module "redis" {
  source = "./modules/redis"

  name_prefix        = local.name_prefix
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.vpc.redis_sg_id]
}

# ── Application Load Balancer ──────────────────────────────────────────────────
module "alb" {
  source = "./modules/alb"

  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = var.acm_certificate_arn
}

# ── ECS cluster + services ─────────────────────────────────────────────────────
module "ecs" {
  source = "./modules/ecs"

  name_prefix          = local.name_prefix
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  alb_target_group_arn = module.alb.api_target_group_arn
  api_sg_id            = module.vpc.api_sg_id

  api_image    = "${module.ecr.api_repo_url}:${var.image_tag}"
  worker_image = "${module.ecr.api_repo_url}:${var.image_tag}"

  redis_url            = module.redis.redis_url
  secrets_manager_arns = module.secrets.secret_arns
}

# ── Secrets Manager ────────────────────────────────────────────────────────────
module "secrets" {
  source = "./modules/secrets"

  name_prefix = local.name_prefix
}

# ── S3 buckets ─────────────────────────────────────────────────────────────────
module "s3" {
  source = "./modules/s3"

  name_prefix  = local.name_prefix
  environment  = var.environment
}

locals {
  name_prefix = "code-review-${var.environment}"
}
