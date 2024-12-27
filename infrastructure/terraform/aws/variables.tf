# AWS Provider version: ~> 5.0

# Project Configuration
variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming and tagging"
  default     = "detection-translator"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment"
  default     = "us-west-2"
}

# Networking Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC networking"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# EKS Configuration
variable "eks_cluster_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  default     = "1.28"
  validation {
    condition     = can(regex("^1\\.\\d+$", var.eks_cluster_version))
    error_message = "EKS cluster version must be in format 1.xx"
  }
}

variable "eks_node_instance_types" {
  type        = list(string)
  description = "Instance types for EKS worker nodes"
  default     = ["r6g.2xlarge"]
}

# Database Configuration
variable "rds_instance_class" {
  type        = string
  description = "Instance class for RDS database"
  default     = "db.r6g.xlarge"
}

# Cache Configuration
variable "redis_node_type" {
  type        = string
  description = "Instance type for Redis nodes"
  default     = "cache.r6g.large"
}

# Backup Configuration
variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups"
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days"
  }
}

# Security Configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable encryption for all supported resources"
  default     = true
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default = {
    Project             = "detection-translator"
    ManagedBy          = "terraform"
    Environment        = "var.environment"
    SecurityCompliance = "required"
    DataClassification = "confidential"
  }
}