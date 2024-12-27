# AWS Provider version: ~> 5.0

# Local variables for CloudFront configuration
locals {
  s3_origin_id = "${var.project_name}-${var.environment}-origin"
  default_ttl  = 3600    # 1 hour default TTL
  max_ttl      = 86400   # 24 hours max TTL
  min_ttl      = 0       # No minimum TTL
}

# Origin Access Identity for secure S3 bucket access
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "Origin Access Identity for ${var.project_name} ${var.environment}"
}

# Main CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled    = true
  http_version       = "http2and3"  # Enable HTTP/2 and HTTP/3 for improved performance
  comment            = "${var.project_name} ${var.environment} distribution"
  default_root_object = "index.html"
  price_class        = "PriceClass_All"  # Deploy to all edge locations for global coverage
  web_acl_id         = aws_wafv2_web_acl.main.id  # Associate with WAF for security

  # Origin configuration for S3
  origin {
    domain_name = aws_s3_bucket.platform_assets.bucket_regional_domain_name
    origin_id   = local.s3_origin_id

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }

    # Enable Origin Shield for additional caching layer
    origin_shield {
      enabled              = true
      origin_shield_region = data.aws_region.current.name
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id
    compress        = true  # Enable compression for faster delivery

    viewer_protocol_policy = "redirect-to-https"  # Force HTTPS
    min_ttl                = local.min_ttl
    default_ttl            = local.default_ttl
    max_ttl                = local.max_ttl

    # Cache configuration
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    # Lambda@Edge for security headers
    lambda_function_association {
      event_type   = "viewer-response"
      lambda_arn   = aws_lambda_function.security_headers.qualified_arn
      include_body = false
    }
  }

  # Custom error responses for SPA support
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Geo-restriction settings (none for global access)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"  # Latest TLS version for security
  }

  # Access logging configuration
  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/"
    include_cookies = false
  }

  # Resource tagging
  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-distribution"
  })
}

# Outputs for DNS and other integrations
output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.domain_name
}