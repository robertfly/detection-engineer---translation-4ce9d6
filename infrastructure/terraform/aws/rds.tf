# AWS RDS Aurora PostgreSQL Configuration for Detection Translation Platform
# Module Version: terraform-aws-modules/rds/aws ~> 5.0

# Local variables for RDS configuration
locals {
  cluster_name = "${var.project_name}-${var.environment}-db"
  database_name = "detection_translator"
  master_username = "admin"
  backup_retention_days = 7
  performance_insights_retention_days = 7
  maintenance_window = "mon:04:00-mon:05:00"
  backup_window = "03:00-04:00"
}

# Security group for RDS cluster
resource "aws_security_group" "rds" {
  name_prefix = "${local.cluster_name}-sg"
  description = "Security group for RDS Aurora cluster"
  vpc_id      = module.vpc.vpc_id

  tags = {
    Name        = "${local.cluster_name}-sg"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# IAM role for RDS enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name_prefix = "${local.cluster_name}-monitoring"
  description = "IAM role for RDS enhanced monitoring"

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
    Name        = "${local.cluster_name}-monitoring-role"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Attach the enhanced monitoring policy to the IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS Aurora PostgreSQL cluster configuration
module "rds_cluster" {
  source  = "terraform-aws-modules/rds/aws"
  version = "5.0"

  # Cluster configuration
  cluster_name    = local.cluster_name
  engine         = "aurora-postgresql"
  engine_version = "14.9"
  instance_class = var.rds_instance_class

  # Instance configuration
  instances = {
    1 = {
      identifier     = "${local.cluster_name}-1"
      instance_class = var.rds_instance_class
      promotion_tier = 0
    }
    2 = {
      identifier     = "${local.cluster_name}-2"
      instance_class = var.rds_instance_class
      promotion_tier = 1
    }
  }

  # Database configuration
  database_name = local.database_name
  master_username = local.master_username
  manage_master_user_password = true

  # Storage configuration
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  # Backup configuration
  backup_retention_period = local.backup_retention_days
  preferred_backup_window = local.backup_window
  preferred_maintenance_window = local.maintenance_window
  copy_tags_to_snapshot = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${local.cluster_name}-final"

  # Network configuration
  vpc_security_group_ids = [aws_security_group.rds.id]
  subnet_ids = module.vpc.private_subnets

  # Monitoring configuration
  enabled_cloudwatch_logs_exports = ["postgresql"]
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = local.performance_insights_retention_days

  # High availability configuration
  deletion_protection = true
  auto_minor_version_upgrade = true

  # Tags
  tags = {
    Name = local.cluster_name
    Environment = var.environment
    Project = var.project_name
    ManagedBy = "terraform"
    BackupRetention = local.backup_retention_days
    PerformanceInsightsRetention = local.performance_insights_retention_days
  }
}

# Output definitions
output "rds_cluster_endpoint" {
  description = "The cluster endpoint for the RDS Aurora cluster"
  value       = module.rds_cluster.cluster_endpoint
}

output "rds_cluster_identifier" {
  description = "The cluster identifier of the RDS Aurora cluster"
  value       = module.rds_cluster.cluster_identifier
}

output "rds_cluster_port" {
  description = "The port number of the RDS Aurora cluster"
  value       = module.rds_cluster.cluster_port
}

output "rds_cluster_master_username" {
  description = "The master username for the RDS Aurora cluster"
  value       = module.rds_cluster.cluster_master_username
  sensitive   = true
}