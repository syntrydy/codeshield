variable "name_prefix" { type = string }

# Dead-letter queue for failed review jobs
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name_prefix}-reviews-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = { Name = "${var.name_prefix}-reviews-dlq" }
}

resource "aws_sqs_queue" "reviews" {
  name                       = "${var.name_prefix}-reviews"
  visibility_timeout_seconds = 960 # must be >= Lambda timeout (900s) + buffer

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.name_prefix}-reviews" }
}

output "queue_url" { value = aws_sqs_queue.reviews.url }
output "queue_arn" { value = aws_sqs_queue.reviews.arn }
output "dlq_arn"   { value = aws_sqs_queue.dlq.arn }
