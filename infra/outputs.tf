output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "api_ecr_repo_url" {
  description = "ECR repository URL for the API/worker image"
  value       = module.ecr.api_repo_url
}

output "web_ecr_repo_url" {
  description = "ECR repository URL for the web image"
  value       = module.ecr.web_repo_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name (used by build-deploy CI to trigger rolling deploys)"
  value       = module.ecs.cluster_name
}

output "ecs_service_api" {
  description = "ECS API service name"
  value       = module.ecs.service_api_name
}

output "ecs_service_worker" {
  description = "ECS worker service name"
  value       = module.ecs.service_worker_name
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
