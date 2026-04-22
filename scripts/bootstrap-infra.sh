#!/usr/bin/env bash
# bootstrap-infra.sh — create the S3 bucket and DynamoDB table that Terraform
# uses for remote state. Run once before 'terraform init'. Idempotent.
#
# Usage:
#   AWS_REGION=us-east-1 TF_STATE_BUCKET=codeshield-tf-state \
#     TF_LOCK_TABLE=codeshield-tf-locks ./scripts/bootstrap-infra.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
TF_STATE_BUCKET="${TF_STATE_BUCKET:-codeshield-tf-state}"
TF_LOCK_TABLE="${TF_LOCK_TABLE:-codeshield-tf-locks}"

echo "Region : $AWS_REGION"
echo "Bucket : $TF_STATE_BUCKET"
echo "Table  : $TF_LOCK_TABLE"
echo

# S3 bucket
if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>/dev/null; then
  echo "✓ S3 bucket already exists: $TF_STATE_BUCKET"
else
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region "$AWS_REGION"
  else
    aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region "$AWS_REGION" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi
  aws s3api put-bucket-versioning --bucket "$TF_STATE_BUCKET" \
    --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$TF_STATE_BUCKET" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-public-access-block --bucket "$TF_STATE_BUCKET" \
    --public-access-block-configuration \
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
  echo "✓ Created S3 bucket: $TF_STATE_BUCKET"
fi

# DynamoDB table
if aws dynamodb describe-table --table-name "$TF_LOCK_TABLE" --region "$AWS_REGION" 2>/dev/null; then
  echo "✓ DynamoDB table already exists: $TF_LOCK_TABLE"
else
  aws dynamodb create-table \
    --table-name "$TF_LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"
  aws dynamodb wait table-exists --table-name "$TF_LOCK_TABLE" --region "$AWS_REGION"
  echo "✓ Created DynamoDB table: $TF_LOCK_TABLE"
fi

echo
echo "Bootstrap complete. Now run:"
echo
echo "  cd infra && terraform init \\"
echo "    -backend-config=\"bucket=\$TF_STATE_BUCKET\" \\"
echo "    -backend-config=\"key=codeshield/prod/terraform.tfstate\" \\"
echo "    -backend-config=\"region=\$AWS_REGION\" \\"
echo "    -backend-config=\"dynamodb_table=\$TF_LOCK_TABLE\""
