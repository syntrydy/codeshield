output "api_url" {
  description = "App Runner service URL for the API (set as VITE_API_BASE_URL in frontend build)"
  value       = "https://${module.apprunner.service_url}"
}

output "api_ecr_repo_url" {
  description = "ECR repository URL for the API/Lambda image"
  value       = module.ecr.api_repo_url
}

output "sqs_queue_url" {
  description = "SQS review queue URL"
  value       = module.sqs.queue_url
}

output "lambda_function_name" {
  description = "Lambda worker function name (used by CI to update function code)"
  value       = module.lambda.function_name
}

output "apprunner_service_id" {
  description = "App Runner service ID (used by CI to trigger deployments)"
  value       = module.apprunner.service_id
}

output "apprunner_service_arn" {
  description = "App Runner service ARN (needed by CodeBuild build-deploy to call start-deployment)"
  value       = module.apprunner.service_arn
}

output "artifacts_bucket" {
  description = "S3 bucket for PR diff artifacts"
  value       = module.s3.artifacts_bucket_name
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name (use as CNAME target for your frontend subdomain)"
  value       = module.cloudfront.cloudfront_domain
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (needed by CI to invalidate the cache after deploy)"
  value       = module.cloudfront.distribution_id
}

output "frontend_bucket" {
  description = "S3 bucket that holds the built frontend assets"
  value       = module.cloudfront.frontend_bucket_name
}

# ── CI/CD ──────────────────────────────────────────────────────────────────────

output "codestar_connection_arn" {
  description = "GitHub CodeStar connection ARN — needs one-time approval in the AWS console before CodeBuild can pull from GitHub"
  value       = aws_codestarconnections_connection.github.arn
}

output "codebuild_test_project" {
  description = "CodeBuild project name for the test pipeline"
  value       = module.codebuild.test_project_name
}

output "codebuild_build_deploy_project" {
  description = "CodeBuild project name for build + deploy"
  value       = module.codebuild.build_deploy_project_name
}

output "codebuild_terraform_project" {
  description = "CodeBuild project name for terraform plan/apply"
  value       = module.codebuild.terraform_project_name
}

output "codebuild_eval_nightly_project" {
  description = "CodeBuild project name for the nightly eval (scheduled by CloudWatch Events)"
  value       = module.codebuild.eval_nightly_project_name
}
