variable "name_prefix"         { type = string }
variable "image_uri"           { type = string }
variable "aws_region"          { type = string }
variable "secrets_prefix"      { type = string }
variable "sqs_queue_url"       { type = string }
variable "supabase_url"        { type = string }
variable "supabase_anon_key"   { type = string }
variable "redis_url"           { type = string }

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
          REDIS_URL                = var.redis_url
          AWS_DEFAULT_REGION       = var.aws_region
          ENVIRONMENT              = "production"
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
