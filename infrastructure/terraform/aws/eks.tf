# AWS Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  cluster_name     = "${var.project_name}-${var.environment}"
  node_group_name  = "${var.project_name}-${var.environment}-nodes"
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "eks"
  })
}

# EKS Cluster Module
module "eks" {
  source = "../modules/eks"

  # Cluster Configuration
  cluster_name    = local.cluster_name
  cluster_version = var.eks_cluster_version
  vpc_id          = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # Node Group Configuration
  node_group_name     = local.node_group_name
  node_instance_types = var.eks_node_instance_types
  min_size           = 2
  max_size           = 10
  desired_size       = 3

  # Security Configuration
  enable_cluster_encryption = true
  enable_pod_security_policy = true
  enable_network_policy = true
  enable_cluster_logging = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  # Additional cluster configurations
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"]

  # Node group configurations
  node_group_ami_type    = "AL2_ARM_64"  # For r6g instances
  node_group_disk_size   = 100
  node_group_capacity_type = "ON_DEMAND"

  # IAM configurations
  create_cluster_role = true
  create_node_role    = true
  enable_irsa        = true

  # Addons
  cluster_addons = {
    coredns = {
      resolve_conflicts = "OVERWRITE"
    }
    kube-proxy = {
      resolve_conflicts = "OVERWRITE"
    }
    vpc-cni = {
      resolve_conflicts = "OVERWRITE"
    }
  }

  # Tags
  tags = local.common_tags
}

# Outputs for cluster access and reference
output "eks_cluster_id" {
  description = "EKS cluster identifier for reference in other resources"
  value       = module.eks.cluster_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint URL for kubectl configuration"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster for network rules"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority" {
  description = "Cluster CA certificate for client authentication"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# Additional cluster configurations through AWS provider
resource "aws_eks_addon" "cluster_addons" {
  for_each          = toset(["aws-ebs-csi-driver", "amazon-cloudwatch-observability"])
  cluster_name      = module.eks.cluster_id
  addon_name        = each.key
  resolve_conflicts = "OVERWRITE"
  tags             = local.common_tags
}

# KMS key for cluster encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                   = local.common_tags
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${local.cluster_name}-eks"
  target_key_id = aws_kms_key.eks.key_id
}