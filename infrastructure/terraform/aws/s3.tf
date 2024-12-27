# AWS Provider version: ~> 5.0

# Local variables for bucket naming and common configurations
locals {
  bucket_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Service = "object-storage"
    ResourceType = "s3"
  })
}

# Detections bucket - Stores detection rules and translations
resource "aws_s3_bucket" "detections" {
  bucket = "${local.bucket_prefix}-detections"
  force_destroy = false  # Prevent accidental deletion

  tags = local.common_tags
}

# Batch results bucket - Stores batch processing results
resource "aws_s3_bucket" "batch_results" {
  bucket = "${local.bucket_prefix}-batch-results"
  force_destroy = false

  tags = local.common_tags
}

# Platform assets bucket - Stores static assets and platform resources
resource "aws_s3_bucket" "platform_assets" {
  bucket = "${local.bucket_prefix}-platform-assets"
  force_destroy = false

  tags = local.common_tags
}

# Enable versioning for detection and batch results buckets
resource "aws_s3_bucket_versioning" "detections" {
  bucket = aws_s3_bucket.detections.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "batch_results" {
  bucket = aws_s3_bucket.batch_results.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Configure server-side encryption using KMS for all buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "detections" {
  bucket = aws_s3_bucket.detections.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "batch_results" {
  bucket = aws_s3_bucket.batch_results.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "platform_assets" {
  bucket = aws_s3_bucket.platform_assets.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = data.aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# Configure lifecycle rules for batch results bucket
resource "aws_s3_bucket_lifecycle_configuration" "batch_results" {
  bucket = aws_s3_bucket.batch_results.id

  rule {
    id     = "cleanup_old_results"
    status = "Enabled"

    expiration {
      days = 90  # Retain batch results for 90 days
    }
  }
}

# Block all public access for all buckets
resource "aws_s3_bucket_public_access_block" "detections" {
  bucket = aws_s3_bucket.detections.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "batch_results" {
  bucket = aws_s3_bucket.batch_results.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "platform_assets" {
  bucket = aws_s3_bucket.platform_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Output the bucket names for use in other modules
output "detection_bucket_name" {
  description = "Name of the S3 bucket storing detection files"
  value       = aws_s3_bucket.detections.id
}

output "batch_results_bucket_name" {
  description = "Name of the S3 bucket storing batch processing results"
  value       = aws_s3_bucket.batch_results.id
}

output "platform_assets_bucket_name" {
  description = "Name of the S3 bucket storing platform assets"
  value       = aws_s3_bucket.platform_assets.id
}