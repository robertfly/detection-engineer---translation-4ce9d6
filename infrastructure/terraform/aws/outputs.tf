# Network Infrastructure Outputs
output "vpc_id" {
  description = "The ID of the VPC where all resources are deployed"
  value       = module.vpc.vpc_id
  sensitive   = false
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for network planning and security group configuration"
  value       = module.vpc.vpc_cidr_block
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for EKS node groups, RDS, and ElastiCache deployment"
  value       = module.vpc.private_subnets
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancers and public-facing resources"
  value       = module.vpc.public_subnets
  sensitive   = false
}

# EKS Cluster Outputs
output "eks_cluster_name" {
  description = "Name of the EKS cluster for kubectl configuration and resource tagging"
  value       = module.eks.cluster_name
  sensitive   = false
}

output "eks_cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "eks_cluster_certificate" {
  description = "Base64 encoded certificate data required for cluster authentication"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "ID of the EKS cluster security group for network rules configuration"
  value       = module.eks.cluster_security_group_id
  sensitive   = false
}

# Database Outputs
output "rds_endpoint" {
  description = "Connection endpoint for the RDS Aurora PostgreSQL cluster"
  value       = module.rds_cluster.cluster_endpoint
  sensitive   = false
}

output "rds_port" {
  description = "Port number for RDS Aurora PostgreSQL cluster connections"
  value       = module.rds_cluster.cluster_port
  sensitive   = false
}

# Cache Outputs
output "redis_endpoint" {
  description = "Connection endpoint for the Redis ElastiCache cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = false
}

output "redis_port" {
  description = "Port number for Redis ElastiCache cluster connections"
  value       = aws_elasticache_replication_group.redis.port
  sensitive   = false
}

# Additional Infrastructure Information
output "environment" {
  description = "Current deployment environment (dev/staging/prod)"
  value       = var.environment
  sensitive   = false
}

output "aws_region" {
  description = "AWS region where the infrastructure is deployed"
  value       = var.aws_region
  sensitive   = false
}

output "infrastructure_version" {
  description = "Version tag for the infrastructure deployment"
  value       = {
    terraform_version = "1.5+"
    vpc_module       = "5.1.2"
    eks_version      = var.eks_cluster_version
    redis_version    = "7.0"
    postgres_version = "14.9"
  }
  sensitive   = false
}