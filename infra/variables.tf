variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["prod", "staging"], var.environment)
    error_message = "environment must be prod or staging"
  }
}

variable "image_tag" {
  description = "Docker image tag to deploy (set to the commit SHA by CI)"
  type        = string
  default     = "latest"
}

# ── Supabase (non-secret values safe to store in Terraform vars) ───────────────

variable "supabase_url" {
  description = "Supabase project URL (e.g. https://xyzcompany.supabase.co)"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase publishable (anon) key — safe to expose to the browser"
  type        = string
}

# ── CloudFront frontend ────────────────────────────────────────────────────────

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
