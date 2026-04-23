variable "name_prefix" { type = string }

resource "aws_dynamodb_table" "cache" {
  name         = "${var.name_prefix}-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = { Name = "${var.name_prefix}-cache" }
}

output "table_name" { value = aws_dynamodb_table.cache.name }
output "table_arn"  { value = aws_dynamodb_table.cache.arn }
