# AWS ElastiCache Redis Configuration for Detection Translation Platform
# Provider Version: hashicorp/aws ~> 5.0

# Local variables for Redis configuration
locals {
  redis_port               = 6379
  redis_family            = "redis7.0"
  redis_maintenance_window = "sun:05:00-sun:07:00"
  redis_snapshot_window   = "03:00-05:00"
  redis_snapshot_retention = 7
}

# Redis subnet group for cluster deployment
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnets

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-subnet-group"
  })
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "Security group for Redis cluster in ${var.environment}"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis access from within VPC"
    from_port   = local.redis_port
    to_port     = local.redis_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Redis parameter group with optimized settings
resource "aws_elasticache_parameter_group" "redis" {
  family = local.redis_family
  name   = "${var.project_name}-${var.environment}-redis-params"

  description = "Redis parameter group for ${var.project_name} ${var.environment}"

  # Memory management configuration
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Enable keyspace notifications for cache events
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  # Connection timeout settings
  parameter {
    name  = "timeout"
    value = "300"
  }

  # Client output buffer limits for pub/sub
  parameter {
    name  = "client-output-buffer-limit-pubsub-hard-limit"
    value = "64mb"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis-params"
  })
}

# Redis replication group (cluster)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description         = "Redis cluster for Detection Translation Platform ${var.environment}"

  # Node configuration
  node_type                  = var.redis_node_type
  num_cache_clusters         = 3
  port                      = local.redis_port

  # Network configuration
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled          = true

  # Engine configuration
  engine         = "redis"
  engine_version = "7.0"

  # Maintenance and backup settings
  maintenance_window      = local.redis_maintenance_window
  snapshot_window        = local.redis_snapshot_window
  snapshot_retention_limit = local.redis_snapshot_retention

  # Security settings
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Auto Minor Version Upgrade
  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-redis"
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Outputs for other modules to consume
output "redis_endpoint" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port number"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}