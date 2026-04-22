variable "name_prefix"          { type = string }
variable "aws_region"           { type = string }
variable "vpc_id"               { type = string }
variable "private_subnet_ids"   { type = list(string) }
variable "alb_target_group_arn" { type = string }
variable "api_sg_id"            { type = string }
variable "api_image"            { type = string }
variable "worker_image"         { type = string }
variable "redis_url"            { type = string }
variable "secrets_manager_arns" { type = map(string) }

# ── CloudWatch Log Groups ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name_prefix}-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name_prefix}-worker"
  retention_in_days = 30
}

# ── IAM ───────────────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.name_prefix}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}

data "aws_iam_policy_document" "ecs_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "exec_policy" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# AmazonECSTaskExecutionRolePolicy does not grant Secrets Manager access.
# This inline policy allows the ECS agent to pull secret values at task startup.
resource "aws_iam_role_policy" "secrets_access" {
  name = "${var.name_prefix}-secrets-access"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = values(var.secrets_manager_arns)
    }]
  })
}

# ── Task definitions ──────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    command   = ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    environment = [
      { name = "REDIS_URL", value = var.redis_url },
    ]
    secrets = [for k, arn in var.secrets_manager_arns : { name = k, valueFrom = arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.worker_image
    essential = true
    command   = ["uv", "run", "celery", "-A", "app.worker.celery_app", "worker", "--loglevel=info", "--concurrency=2"]
    environment = [
      { name = "REDIS_URL", value = var.redis_url },
    ]
    secrets = [for k, arn in var.secrets_manager_arns : { name = k, valueFrom = arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  depends_on = [aws_cloudwatch_log_group.worker]
}

# ── ECS Services ──────────────────────────────────────────────────────────────
resource "aws_ecs_service" "api" {
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.api_sg_id]
  }

  load_balancer {
    target_group_arn = var.alb_target_group_arn
    container_name   = "api"
    container_port   = 8000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}

resource "aws_ecs_service" "worker" {
  name            = "${var.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.api_sg_id]
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}

output "cluster_name"       { value = aws_ecs_cluster.main.name }
output "service_api_name"    { value = aws_ecs_service.api.name }
output "service_worker_name" { value = aws_ecs_service.worker.name }
