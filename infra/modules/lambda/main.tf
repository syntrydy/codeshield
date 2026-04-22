variable "name_prefix"         { type = string }
variable "image_uri"           { type = string }
variable "sqs_queue_arn"       { type = string }
variable "sqs_queue_url"       { type = string }
variable "secrets_prefix"      { type = string }
variable "supabase_url"        { type = string }
variable "supabase_anon_key"   { type = string }
variable "aws_region"          { type = string }

# ── IAM role ──────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name_prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "lambda_perms" {
  # CloudWatch Logs
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }

  # SQS consume
  statement {
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [var.sqs_queue_arn]
  }

  # Secrets Manager — read all secrets under our prefix
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.secrets_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "lambda-policy"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_perms.json
}

# ── CloudWatch log group ───────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name_prefix}-worker"
  retention_in_days = 14
}

# ── Lambda function ───────────────────────────────────────────────────────────

resource "aws_lambda_function" "worker" {
  function_name = "${var.name_prefix}-worker"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = var.image_uri

  # LangGraph reviews can take several minutes; 15 min is the Lambda hard limit
  timeout     = 900
  memory_size = 2048

  environment {
    variables = {
      TASK_BACKEND    = "sqs"
      SQS_QUEUE_URL   = var.sqs_queue_url
      SECRETS_PREFIX  = var.secrets_prefix
      SUPABASE_URL    = var.supabase_url
      SUPABASE_PUBLISHABLE_KEY = var.supabase_anon_key
      AWS_DEFAULT_REGION = var.aws_region
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]

  tags = { Name = "${var.name_prefix}-worker" }
}

# ── SQS trigger ───────────────────────────────────────────────────────────────

resource "aws_lambda_event_source_mapping" "sqs" {
  event_source_arn                   = var.sqs_queue_arn
  function_name                      = aws_lambda_function.worker.arn
  batch_size                         = 1   # one PR review per invocation
  maximum_batching_window_in_seconds = 0
}

output "function_name" { value = aws_lambda_function.worker.function_name }
output "function_arn"  { value = aws_lambda_function.worker.arn }
