variable "name_prefix"  { type = string }
variable "environment"  { type = string }

resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.name_prefix}-artifacts"
  tags   = { Name = "${var.name_prefix}-artifacts", Environment = var.environment }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-pr-diffs"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }
  }
}

output "artifacts_bucket_name" { value = aws_s3_bucket.artifacts.bucket }
