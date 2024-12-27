# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for consistent naming and tagging
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    ManagedBy           = "terraform"
    SecurityCompliance  = "SOC2"
    NIST               = "800-53"
    LastUpdated        = timestamp()
  })
}

# EKS Cluster Role
resource "aws_iam_role" "eks_cluster_role" {
  name = "${local.name_prefix}-eks-cluster-role"
  description = "IAM role for EKS cluster with enhanced security controls"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount": data.aws_caller_identity.current.account_id
        }
        StringLike = {
          "aws:SourceArn": "arn:aws:eks:*:${data.aws_caller_identity.current.account_id}:cluster/*"
        }
      }
    }]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  ]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-cluster-role"
    Purpose = "EKS cluster management"
  })
}

# EKS Node Role
resource "aws_iam_role" "eks_node_role" {
  name = "${local.name_prefix}-eks-node-role"
  description = "IAM role for EKS worker nodes with least privilege access"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount": data.aws_caller_identity.current.account_id
        }
      }
    }]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  ]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-node-role"
    Purpose = "EKS worker node operations"
  })
}

# EKS OIDC Provider
resource "aws_iam_openid_connect_provider" "eks_oidc_provider" {
  url = module.eks.cluster_oidc_issuer_url
  
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "9e99a48a9960b14926bb7f3b02e22da2b0ab7280" # Root CA thumbprint
  ]

  tags = merge(local.common_tags, {
    Purpose = "EKS OIDC authentication"
  })
}

# Translation Service Role
resource "aws_iam_role" "translation_service_role" {
  name = "${local.name_prefix}-translation-service-role"
  description = "IAM role for translation service with secure GenAI access"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks_oidc_provider.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.eks_oidc_provider.url, "https://", "")}:sub": "system:serviceaccount:translation:translation-service"
        }
      }
    }]
  })

  inline_policy {
    name = "translation_service_permissions"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "bedrock:InvokeModel",
            "s3:GetObject",
            "s3:PutObject",
            "s3:ListBucket"
          ]
          Resource = [
            "arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:foundation-model/*",
            "arn:aws:s3:::${local.name_prefix}-detections/*",
            "arn:aws:s3:::${local.name_prefix}-detections"
          ]
        },
        {
          Effect = "Allow"
          Action = [
            "kms:Decrypt",
            "kms:GenerateDataKey"
          ]
          Resource = [
            aws_kms_key.translation_key.arn
          ]
        }
      ]
    })
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-translation-service-role"
    Purpose = "Detection translation operations"
  })
}

# Validation Service Role
resource "aws_iam_role" "validation_service_role" {
  name = "${local.name_prefix}-validation-service-role"
  description = "IAM role for validation service with enhanced security"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks_oidc_provider.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.eks_oidc_provider.url, "https://", "")}:sub": "system:serviceaccount:validation:validation-service"
        }
      }
    }]
  })

  inline_policy {
    name = "validation_service_permissions"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "s3:GetObject",
            "s3:ListBucket"
          ]
          Resource = [
            "arn:aws:s3:::${local.name_prefix}-detections/*",
            "arn:aws:s3:::${local.name_prefix}-detections"
          ]
        },
        {
          Effect = "Allow"
          Action = [
            "kms:Decrypt"
          ]
          Resource = [
            aws_kms_key.validation_key.arn
          ]
        }
      ]
    })
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-validation-service-role"
    Purpose = "Detection validation operations"
  })
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Outputs
output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role for cross-service authentication"
  value       = aws_iam_role.eks_cluster_role.arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role for worker node operations"
  value       = aws_iam_role.eks_node_role.arn
}

output "translation_service_role_arn" {
  description = "ARN of the translation service IAM role for GenAI operations"
  value       = aws_iam_role.translation_service_role.arn
}

output "validation_service_role_arn" {
  description = "ARN of the validation service IAM role for security checks"
  value       = aws_iam_role.validation_service_role.arn
}