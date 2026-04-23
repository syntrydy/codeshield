variable "name_prefix"         { type = string }
variable "image_uri"           { type = string }
variable "aws_region"          { type = string }
variable "secrets_prefix"      { type = string }
variable "sqs_queue_url"       { type = string }
variable "supabase_url"        { type = string }
variable "supabase_anon_key"   { type = string }
variable "cache_table_name"    { type = string }
variable "cache_table_arn"     { type = string }
variable "secret_arns"         { type = map(string) }
variable "cloudfront_domain"   { type = string }

# ── IAM roles ──────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "apprunner_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

# Access role: allows App Runner to pull from ECR
resource "aws_iam_role" "access" {
  name               = "${var.name_prefix}-apprunner-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_assume.json
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

# Instance role: allows the running container to call Secrets Manager and SQS
resource "aws_iam_role" "instance" {
  name               = "${var.name_prefix}-apprunner-instance"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json
}

data "aws_iam_policy_document" "instance_perms" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.secrets_prefix}/*"]
  }

  statement {
    actions   = ["sqs:SendMessage", "sqs:GetQueueAttributes"]
    resources = ["*"]
  }

  # DynamoDB cache table
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [var.cache_table_arn]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "instance-policy"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance_perms.json
}

# ── App Runner service ────────────────────────────────────────────────────────

resource "aws_apprunner_service" "api" {
  service_name = "${var.name_prefix}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.access.arn
    }

    image_repository {
      image_identifier      = var.image_uri
      image_repository_type = "ECR"

      image_configuration {
        port = "8000"

        runtime_environment_variables = {
          TASK_BACKEND             = "sqs"
          SQS_QUEUE_URL            = var.sqs_queue_url
          SECRETS_PREFIX           = var.secrets_prefix
          SUPABASE_URL             = var.supabase_url
          SUPABASE_PUBLISHABLE_KEY = var.supabase_anon_key
          CACHE_TABLE_NAME         = var.cache_table_name
          AWS_DEFAULT_REGION       = var.aws_region
          ENVIRONMENT              = "production"
          CORS_ORIGINS             = "[\"https://${var.cloudfront_domain}\"]"
          LANGCHAIN_TRACING_V2     = "true"
          LANGSMITH_PROJECT        = "CodeShieldDev"
          LANGSMITH_ENDPOINT       = "https://eu.api.smith.langchain.com"
        }

        runtime_environment_secrets = {
          SUPABASE_SECRET_KEY   = var.secret_arns["SUPABASE_SERVICE_ROLE_KEY"]
          GITHUB_APP_ID         = var.secret_arns["GITHUB_APP_ID"]
          GITHUB_APP_SLUG       = var.secret_arns["GITHUB_APP_SLUG"]
          GITHUB_WEBHOOK_SECRET = var.secret_arns["GITHUB_WEBHOOK_SECRET"]
          ANTHROPIC_API_KEY     = var.secret_arns["ANTHROPIC_API_KEY"]
          LANGSMITH_API_KEY     = var.secret_arns["LANGSMITH_API_KEY"]
        }
      }
    }

    auto_deployments_enabled = false # CI controls deploys explicitly
  }

  instance_configuration {
    instance_role_arn = aws_iam_role.instance.arn
    cpu               = "1 vCPU"
    memory            = "2 GB"
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  tags = { Name = "${var.name_prefix}-api" }
}

output "service_url"  { value = aws_apprunner_service.api.service_url }
output "service_arn"  { value = aws_apprunner_service.api.arn }
output "service_id"   { value = aws_apprunner_service.api.service_id }
