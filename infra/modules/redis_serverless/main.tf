variable "name_prefix" { type = string }

# ElastiCache Serverless — pay per GB-hour and per request; no minimum nodes
resource "aws_elasticache_serverless_cache" "redis" {
  engine = "redis"
  name   = "${var.name_prefix}-cache"

  cache_usage_limits {
    data_storage {
      maximum = 5  # GB — hard cap; auto-scales below this
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = 5000
    }
  }

  major_engine_version = "7"

  tags = { Name = "${var.name_prefix}-cache" }
}

output "endpoint" {
  value = aws_elasticache_serverless_cache.redis.endpoint[0].address
}

output "redis_url" {
  value = "rediss://${aws_elasticache_serverless_cache.redis.endpoint[0].address}:6379/0"
}
