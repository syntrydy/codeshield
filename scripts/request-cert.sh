#!/usr/bin/env bash
# request-cert.sh — request an ACM certificate for a subdomain, print the
# DNS validation CNAME to add at your DNS provider, wait for issuance, and
# print the ARN for terraform.tfvars.
#
# Usage:
#   DOMAIN=codeshield.yourdomain.com ./scripts/request-cert.sh
#
# After the cert is issued, point DOMAIN → ALB with a CNAME record:
#   CNAME codeshield.yourdomain.com → $(cd infra && terraform output -raw alb_dns_name)

set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN=codeshield.yourdomain.com}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Requesting ACM certificate for: $DOMAIN"

CERT_ARN=$(aws acm request-certificate \
  --domain-name "$DOMAIN" \
  --validation-method DNS \
  --region "$AWS_REGION" \
  --query 'CertificateArn' \
  --output text)

echo "ARN: $CERT_ARN"
echo "Waiting for validation record to be available..."

for i in $(seq 1 12); do
  VALIDATION_JSON=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$AWS_REGION" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
    --output json 2>/dev/null)
  [ "$VALIDATION_JSON" != "null" ] && [ -n "$VALIDATION_JSON" ] && break
  sleep 5
done

CNAME_NAME=$(echo "$VALIDATION_JSON"  | python3 -c "import sys,json; print(json.load(sys.stdin)['Name'])")
CNAME_VALUE=$(echo "$VALIDATION_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['Value'])")

echo
echo "Add this CNAME record at your DNS provider:"
echo "  Name : $CNAME_NAME"
echo "  Value: $CNAME_VALUE"
echo
echo "Press Enter once the record is saved, then this script will wait for issuance."
read -r

echo "Waiting for certificate validation (up to 10 min)..."
aws acm wait certificate-validated \
  --certificate-arn "$CERT_ARN" \
  --region "$AWS_REGION"

echo
echo "✓ Certificate issued."
echo
echo "1. Add to infra/terraform.tfvars:"
echo "     acm_certificate_arn = \"$CERT_ARN\""
echo
echo "2. After terraform apply, point your subdomain at the ALB:"
echo "     CNAME $DOMAIN → \$(cd infra && terraform output -raw alb_dns_name)"
