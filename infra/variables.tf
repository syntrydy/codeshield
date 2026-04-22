variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["prod", "staging"], var.environment)
    error_message = "environment must be prod or staging"
  }
}

variable "availability_zones" {
  description = "AZs to deploy into (at least 2)"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the ALB HTTPS listener"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag to deploy (set to the commit SHA by CI)"
  type        = string
  default     = "latest"
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN for the CloudFront frontend (must be in us-east-1). Null = use the default cloudfront.net domain."
  type        = string
  default     = null
}

variable "cloudfront_domain" {
  description = "Custom subdomain for the frontend (e.g. app.yourdomain.com). Requires cloudfront_certificate_arn."
  type        = string
  default     = null
}
