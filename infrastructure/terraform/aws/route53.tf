# AWS Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Main Route53 hosted zone for the domain
resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "Managed by Terraform - Detection Translation Platform ${var.environment}"

  # Prevent accidental deletion of the zone
  force_destroy = false

  tags = merge(var.tags, {
    Name        = "${var.domain_name}-zone"
    Environment = var.environment
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Health check for the main domain endpoint
resource "aws_route53_health_check" "main" {
  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30
  
  # Multi-region health checking for improved reliability
  regions = [
    "us-east-1",    # North America
    "eu-west-1",    # Europe
    "ap-southeast-1" # Asia Pacific
  ]

  enable_sni         = true
  search_string      = "healthy"
  measure_latency    = true
  invert_healthcheck = false
  disabled           = false

  tags = merge(var.tags, {
    Name        = "${var.domain_name}-health-check"
    Environment = var.environment
  })
}

# A record for the apex domain pointing to CloudFront
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id               = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# WWW subdomain CNAME record
resource "aws_route53_record" "www" {
  zone_id         = aws_route53_zone.main.zone_id
  name            = "www.${var.domain_name}"
  type            = "CNAME"
  ttl             = 300
  records         = [var.domain_name]
  health_check_id = aws_route53_health_check.main.id
}

# Data source for existing Route53 zone validation
data "aws_route53_zone" "existing" {
  name         = var.domain_name
  private_zone = false
  provider     = aws.primary
}

# Outputs for external reference
output "route53_zone_id" {
  description = "The ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "route53_nameservers" {
  description = "The nameservers for the Route53 zone"
  value       = aws_route53_zone.main.name_servers
}