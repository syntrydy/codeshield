# ── IAM service role (shared by all 4 CodeBuild projects) ─────────────────────

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name               = "${var.name_prefix}-codebuild"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

# AdministratorAccess — the `terraform` project creates/modifies everything in
# the account, so the role needs broad perms. The other three projects share
# the role for simplicity. If you need tighter scoping, split into two roles.
resource "aws_iam_role_policy_attachment" "codebuild_admin" {
  role       = aws_iam_role.codebuild.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# ── CloudWatch log group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/aws/codebuild/${var.name_prefix}"
  retention_in_days = 30
}

# ── Common locals ─────────────────────────────────────────────────────────────

locals {
  # Build-deploy non-secret env vars (plaintext injected into the build environment).
  build_deploy_env = {
    AWS_ACCOUNT_ID                = var.aws_account_id
    AWS_REGION                    = var.aws_region
    ECR_REPO_API                  = var.ecr_repo_name
    APPRUNNER_SERVICE_ARN         = var.apprunner_service_arn
    LAMBDA_FUNCTION_NAME          = var.lambda_function_name
    FRONTEND_BUCKET               = var.frontend_bucket
    CF_DIST_ID                    = var.cloudfront_distribution_id
    API_HEALTH_URL                = var.api_health_url
    VITE_SUPABASE_URL             = var.vite_supabase_url
    VITE_SUPABASE_PUBLISHABLE_KEY = var.vite_supabase_publishable_key
    VITE_API_BASE_URL             = var.vite_api_base_url
    VITE_GITHUB_APP_SLUG          = var.vite_github_app_slug
  }

  # test project needs Supabase URL + publishable key at Python import time
  # (GITHUB_*, OPENAI_API_KEY, etc. come from Secrets Manager per the buildspec).
  test_env = {
    SUPABASE_URL             = var.supabase_url
    SUPABASE_PUBLISHABLE_KEY = var.supabase_publishable_key
  }

  terraform_env = {
    AWS_REGION      = var.aws_region
    TF_STATE_BUCKET = var.tf_state_bucket
    TF_STATE_KEY    = var.tf_state_key
    TF_LOCK_TABLE   = var.tf_lock_table
    # TF_VAR_* values passed through to required root-module variables.
    TF_VAR_supabase_url      = var.supabase_url
    TF_VAR_supabase_anon_key = var.supabase_publishable_key
    TF_VAR_github_repo_url   = var.github_repo_url
    TF_VAR_github_app_slug   = var.vite_github_app_slug
    TF_VAR_tf_state_bucket   = var.tf_state_bucket
    TF_VAR_tf_lock_table     = var.tf_lock_table
  }

  eval_env = {
    AWS_REGION = var.aws_region
  }
}

# ── Project: test (ruff + pytest + frontend build + fast eval) ────────────────

resource "aws_codebuild_project" "test" {
  name         = "${var.name_prefix}-test"
  description  = "Lint + tests + fast eval subset. Triggered on every push and PR."
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = false

    dynamic "environment_variable" {
      for_each = local.test_env
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repo_url
    git_clone_depth = 1
    buildspec       = "buildspec/test.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
      stream_name = "test"
    }
  }
}

resource "aws_codebuild_webhook" "test" {
  project_name = aws_codebuild_project.test.name

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH, PULL_REQUEST_CREATED, PULL_REQUEST_UPDATED, PULL_REQUEST_REOPENED"
    }
  }
}

# ── Project: build-deploy (image → ECR, Lambda + App Runner + S3 + CF) ────────

resource "aws_codebuild_project" "build_deploy" {
  name         = "${var.name_prefix}-build-deploy"
  description  = "Build API image + deploy to Lambda/App Runner + sync frontend. Push to main."
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_MEDIUM"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true # needed for docker build

    dynamic "environment_variable" {
      for_each = local.build_deploy_env
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repo_url
    git_clone_depth = 1
    buildspec       = "buildspec/build-deploy.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
      stream_name = "build-deploy"
    }
  }
}

resource "aws_codebuild_webhook" "build_deploy" {
  project_name = aws_codebuild_project.build_deploy.name

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH"
    }
    filter {
      type    = "HEAD_REF"
      pattern = "^refs/heads/main$"
    }
  }
}

# ── Project: terraform (plan on PR, apply on main) ────────────────────────────

resource "aws_codebuild_project" "terraform" {
  name         = "${var.name_prefix}-terraform"
  description  = "terraform plan on PR, terraform apply on main. Only on infra/** changes."
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = false

    dynamic "environment_variable" {
      for_each = local.terraform_env
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repo_url
    git_clone_depth = 1
    buildspec       = "buildspec/terraform.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
      stream_name = "terraform"
    }
  }
}

resource "aws_codebuild_webhook" "terraform" {
  project_name = aws_codebuild_project.terraform.name

  # PR events touching infra/**
  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PULL_REQUEST_CREATED, PULL_REQUEST_UPDATED, PULL_REQUEST_REOPENED"
    }
    filter {
      type    = "FILE_PATH"
      pattern = "^infra/.+"
    }
  }

  # push to main touching infra/**
  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH"
    }
    filter {
      type    = "HEAD_REF"
      pattern = "^refs/heads/main$"
    }
    filter {
      type    = "FILE_PATH"
      pattern = "^infra/.+"
    }
  }
}

# ── Project: eval-nightly (scheduled — no webhook, CloudWatch Events) ─────────

resource "aws_codebuild_project" "eval_nightly" {
  name         = "${var.name_prefix}-eval-nightly"
  description  = "Full eval suite. Runs nightly on a CloudWatch schedule."
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = false

    dynamic "environment_variable" {
      for_each = local.eval_env
      content {
        name  = environment_variable.key
        value = environment_variable.value
      }
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repo_url
    git_clone_depth = 1
    buildspec       = "buildspec/eval-nightly.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
      stream_name = "eval-nightly"
    }
  }
}

# ── Nightly schedule for eval_nightly (02:00 UTC daily) ───────────────────────

resource "aws_cloudwatch_event_rule" "eval_nightly" {
  name                = "${var.name_prefix}-eval-nightly"
  description         = "Fires daily at 02:00 UTC to run the full eval suite"
  schedule_expression = "cron(0 2 * * ? *)"
}

data "aws_iam_policy_document" "events_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events_to_codebuild" {
  name               = "${var.name_prefix}-events-codebuild"
  assume_role_policy = data.aws_iam_policy_document.events_assume.json
}

resource "aws_iam_role_policy" "events_to_codebuild" {
  role = aws_iam_role.events_to_codebuild.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "codebuild:StartBuild"
      Resource = aws_codebuild_project.eval_nightly.arn
    }]
  })
}

resource "aws_cloudwatch_event_target" "eval_nightly" {
  rule      = aws_cloudwatch_event_rule.eval_nightly.name
  target_id = "code-review-eval-nightly"
  arn       = aws_codebuild_project.eval_nightly.arn
  role_arn  = aws_iam_role.events_to_codebuild.arn
}
