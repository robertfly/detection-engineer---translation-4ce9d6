# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  database_name         = "detection_translator"
  master_username       = "admin"
  backup_window        = "03:00-04:00"
  maintenance_window   = "mon:04:00-mon:05:00"
  monitoring_role_name = "${var.cluster_name}-monitoring-role"
}

# RDS Aurora PostgreSQL Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier           = var.cluster_name
  engine                      = "aurora-postgresql"
  engine_version              = "14.9"
  database_name               = local.database_name
  master_username             = local.master_username
  manage_master_user_password = true # Uses AWS Secrets Manager for password management
  
  # Network Configuration
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [var.security_group_id]
  
  # Encryption Configuration
  storage_encrypted = true
  kms_key_id       = var.kms_key_id
  
  # Backup Configuration
  backup_retention_period   = 7
  preferred_backup_window   = local.backup_window
  preferred_maintenance_window = local.maintenance_window
  
  # Protection Settings
  deletion_protection   = true
  skip_final_snapshot   = false
  final_snapshot_identifier = "${var.cluster_name}-final"
  copy_tags_to_snapshot = true
  
  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Tags
  tags = {
    Name             = var.cluster_name
    Environment      = var.environment
    ManagedBy        = "terraform"
    Service          = "detection-translator"
    BackupRetention  = "7-days"
  }
}

# RDS Cluster Instances
resource "aws_rds_cluster_instance" "main" {
  count = 2 # Creates primary and replica instances
  
  identifier          = "${var.cluster_name}-${count.index + 1}"
  cluster_identifier  = aws_rds_cluster.main.id
  instance_class      = var.instance_class
  engine             = "aurora-postgresql"
  engine_version     = "14.9"
  
  # Instance Configuration
  auto_minor_version_upgrade = true
  
  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  
  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  # Instance Role
  promotion_tier = count.index
  
  tags = {
    Name        = "${var.cluster_name}-${count.index + 1}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "detection-translator"
    Role        = count.index == 0 ? "primary" : "replica"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.cluster_name}-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = {
    Name         = "${var.cluster_name}-subnet-group"
    Environment  = var.environment
    ManagedBy    = "terraform"
    Service      = "detection-translator"
    NetworkTier  = "database"
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = local.monitoring_role_name
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Name        = local.monitoring_role_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "detection-translator"
  }
}

# Attach the enhanced monitoring policy to the role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "cluster_endpoint" {
  value       = aws_rds_cluster.main.endpoint
  description = "The connection endpoint for the RDS cluster"
}

output "cluster_identifier" {
  value       = aws_rds_cluster.main.cluster_identifier
  description = "The identifier of the RDS cluster"
}

output "cluster_port" {
  value       = aws_rds_cluster.main.port
  description = "The port number of the RDS cluster"
}

output "cluster_master_username" {
  value       = aws_rds_cluster.main.master_username
  description = "The master username for the RDS cluster"
  sensitive   = true
}

output "cluster_database_name" {
  value       = aws_rds_cluster.main.database_name
  description = "The name of the default database"
}

output "monitoring_role_arn" {
  value       = aws_iam_role.rds_monitoring.arn
  description = "The ARN of the monitoring IAM role"
}