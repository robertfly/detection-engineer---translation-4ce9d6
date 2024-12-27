# AWS Provider version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Backend configuration should be provided via backend config file
    encrypt = true
  }
}

# Local variables for resource naming and tagging
locals {
  common_tags = {
    Project           = "detection-translator"
    Environment      = var.environment
    ManagedBy        = "terraform"
    SecurityLevel    = "high"
    BackupEnabled    = "true"
    MonitoringEnabled = "true"
    ComplianceLevel  = "soc2"
  }
}

# VPC Module for network infrastructure
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "${var.project_name}-vpc"
  cidr = var.vpc_cidr

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
  enable_flow_log        = true
  flow_log_destination_type = "cloud-watch-logs"

  tags = local.common_tags
}

# EKS Module for Kubernetes cluster
module "eks" {
  source = "../modules/eks"

  cluster_name        = "${var.project_name}-${var.environment}"
  cluster_version     = var.eks_cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnets
  node_instance_types = var.eks_node_instance_types
  
  enable_monitoring         = true
  enable_logging           = true
  enable_secrets_encryption = true
  
  tags = local.common_tags
}

# RDS Module for database cluster
module "rds" {
  source = "../modules/rds"

  cluster_name        = "${var.project_name}-${var.environment}"
  instance_class     = var.rds_instance_class
  subnet_ids         = module.vpc.private_subnets
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  multi_az                     = true
  backup_retention_period      = 7
  enable_performance_insights  = true
  enable_encryption           = true
  
  tags = local.common_tags
}

# ElastiCache Module for Redis cluster
module "elasticache" {
  source  = "terraform-aws-modules/elasticache/aws"
  version = "3.0.0"

  cluster_id           = "${var.project_name}-${var.environment}"
  engine              = "redis"
  node_type           = var.redis_node_type
  num_cache_nodes     = 2
  parameter_group_family = "redis7"
  port                = 6379
  
  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.redis.id]
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  tags = local.common_tags
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
    description     = "Allow Redis access from EKS cluster"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = local.common_tags
}

# Security group for RDS cluster
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS cluster"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
    description     = "Allow PostgreSQL access from EKS cluster"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "The endpoint for the EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "The endpoint for the RDS cluster"
  value       = module.rds.cluster_endpoint
}

output "redis_endpoint" {
  description = "The endpoint for the Redis cluster"
  value       = module.elasticache.cluster_endpoint
}