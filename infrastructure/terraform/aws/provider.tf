# Provider version: ~> 5.0
# Kubernetes provider version: ~> 2.23
# Random provider version: ~> 3.5

terraform {
  # Enforce minimum Terraform version for compatibility
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# Default AWS provider configuration using the specified region
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "detection-translator"
      ManagedBy   = "terraform"
      Environment = "production"
      Service     = "detection-translation-platform"
    }
  }

  # Recommended provider configurations for production
  skip_metadata_api_check     = true
  skip_region_validation     = false
  skip_credentials_validation = false
  skip_requesting_account_id = false

  # Enable automatic retry logic
  retry_mode = "standard"
  max_retries = 3
}

# Additional provider configuration for us-east-1 region (for global services like CloudFront)
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "detection-translator"
      ManagedBy   = "terraform"
      Environment = "production"
      Service     = "detection-translation-platform"
    }
  }

  # Recommended provider configurations for production
  skip_metadata_api_check     = true
  skip_region_validation     = false
  skip_credentials_validation = false
  skip_requesting_account_id = false

  # Enable automatic retry logic
  retry_mode = "standard"
  max_retries = 3
}

# Note: Authentication is expected to be handled via environment variables or IAM roles:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_SESSION_TOKEN (if using temporary credentials)
# 
# Alternative authentication methods:
# - AWS shared credentials file (~/.aws/credentials)
# - AWS SSO
# - IAM Instance Profile when running on EC2
# - ECS Task Role when running on ECS
# - Workspace variables in Terraform Cloud/Enterprise