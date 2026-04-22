#!/usr/bin/env bash
# request-cert.sh — request an ACM certificate for a subdomain, validate via
# Route 53, wait for issuance, and print the ARN for terraform.tfvars.
#
# Usage:
#   DOMAIN=codeshield.yourdomain.com ROUTE53_ZONE_ID=ZXXXXXXXXXXXXX \
#     ./scripts/request-cert.sh
#
# DOMAIN        — the subdomain to certify (e.g. codeshield.yourdomain.com)
# ROUTE53_ZONE_ID — the hosted zone ID of the parent domain in Route 53
# AWS_REGION    — defaults to us-east-1
#
# After the cert is issued, create one more CNAME (or ALIAS) in Route 53
# pointing DOMAIN → the ALB DNS name printed by 'terraform output'.

set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN=codeshield.yourdomain.com}"
ROUTE53_ZONE_ID="${ROUTE53_ZONE_ID:?Set ROUTE53_ZONE_ID to your hosted zone ID}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Requesting ACM certificate for: $DOMAIN"

CERT_ARN=$(aws acm request-certificate \
  --domain-name "$DOMAIN" \
  --validation-method DNS \
  --region "$AWS_REGION" \
  --query 'CertificateArn' \
  --output text)

echo "ARN: $CERT_ARN"
echo "Waiting for validation record..."

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

CHANGE_BATCH=$(python3 -c "
import json
print(json.dumps({'Changes': [{'Action': 'UPSERT', 'ResourceRecordSet': {
  'Name': '$CNAME_NAME', 'Type': 'CNAME', 'TTL': 300,
  'ResourceRecords': [{'Value': '$CNAME_VALUE'}]}}]}))
")

aws route53 change-resource-record-sets \
  --hosted-zone-id "$ROUTE53_ZONE_ID" \
  --change-batch "$CHANGE_BATCH" \
  --output text --query 'ChangeInfo.Id' > /dev/null

echo "Validation CNAME added to Route 53. Waiting for issuance (up to 10 min)..."

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
