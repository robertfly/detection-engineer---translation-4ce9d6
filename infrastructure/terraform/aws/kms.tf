# AWS KMS configuration for encryption key management
# Provider version: ~> 5.0

# Get current AWS account ID for IAM policies
data "aws_caller_identity" "current" {}

locals {
  # Common configuration for KMS keys
  key_administrators = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/Admin"
  ]
  key_deletion_window = 30
  key_rotation_enabled = true
  key_spec = "SYMMETRIC_DEFAULT"
  key_usage = "ENCRYPT_DECRYPT"
  
  # Common tags for all KMS resources
  common_tags = merge(var.tags, {
    Service = "KMS"
    Encryption = "AES-256"
  })
}

# Application Data Encryption Key
resource "aws_kms_key" "app_encryption" {
  description              = "KMS key for application data encryption with automatic rotation"
  deletion_window_in_days  = local.key_deletion_window
  enable_key_rotation     = local.key_rotation_enabled
  customer_master_key_spec = local.key_spec
  key_usage               = local.key_usage
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = local.key_administrators
        }
        Action = "kms:*"
        Resource = "*"
      },
      {
        Sid = "Allow Application Service Access"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-app-encryption"
    SecurityCompliance = "SOC2-NIST800-53"
  })
}

# RDS Database Encryption Key
resource "aws_kms_key" "rds_encryption" {
  description              = "KMS key for RDS database encryption with compliance controls"
  deletion_window_in_days  = local.key_deletion_window
  enable_key_rotation     = local.key_rotation_enabled
  customer_master_key_spec = local.key_spec
  key_usage               = local.key_usage
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = local.key_administrators
        }
        Action = "kms:*"
        Resource = "*"
      },
      {
        Sid = "Allow RDS Service Access"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-rds-encryption"
    SecurityCompliance = "SOC2-NIST800-53"
  })
}

# Redis Cache Encryption Key
resource "aws_kms_key" "redis_encryption" {
  description              = "KMS key for Redis cluster encryption with security controls"
  deletion_window_in_days  = local.key_deletion_window
  enable_key_rotation     = local.key_rotation_enabled
  customer_master_key_spec = local.key_spec
  key_usage               = local.key_usage
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = local.key_administrators
        }
        Action = "kms:*"
        Resource = "*"
      },
      {
        Sid = "Allow ElastiCache Service Access"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-redis-encryption"
    SecurityCompliance = "SOC2-NIST800-53"
  })
}

# Key Aliases for easier reference
resource "aws_kms_alias" "app_encryption" {
  name          = "alias/${var.project_name}-${var.environment}-app-encryption"
  target_key_id = aws_kms_key.app_encryption.key_id
}

resource "aws_kms_alias" "rds_encryption" {
  name          = "alias/${var.project_name}-${var.environment}-rds-encryption"
  target_key_id = aws_kms_key.rds_encryption.key_id
}

resource "aws_kms_alias" "redis_encryption" {
  name          = "alias/${var.project_name}-${var.environment}-redis-encryption"
  target_key_id = aws_kms_key.redis_encryption.key_id
}

# Output the KMS key ARNs for use by other resources
output "app_encryption_key_arn" {
  description = "ARN of the application encryption key for use by application services"
  value       = aws_kms_key.app_encryption.arn
}

output "rds_encryption_key_arn" {
  description = "ARN of the RDS encryption key for database encryption"
  value       = aws_kms_key.rds_encryption.arn
}

output "redis_encryption_key_arn" {
  description = "ARN of the Redis encryption key for cache encryption"
  value       = aws_kms_key.redis_encryption.arn
}