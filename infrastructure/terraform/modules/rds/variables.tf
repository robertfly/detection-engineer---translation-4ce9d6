# RDS Cluster Configuration Variables
variable "cluster_name" {
  type        = string
  description = "Name of the RDS cluster"
  validation {
    condition     = length(var.cluster_name) <= 63
    error_message = "RDS cluster name must be 63 characters or less"
  }
}

variable "engine_version" {
  type        = string
  description = "Aurora PostgreSQL engine version"
  default     = "14.9"
}

variable "instance_class" {
  type        = string
  description = "Instance class for RDS instances"
  default     = "db.r6g.xlarge"
}

variable "instance_count" {
  type        = number
  description = "Number of instances in the RDS cluster"
  default     = 2
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 15
    error_message = "Instance count must be between 1 and 15"
  }
}

variable "database_name" {
  type        = string
  description = "Name of the default database to create"
  default     = "detection_translator"
}

variable "master_username" {
  type        = string
  description = "Master username for the RDS cluster"
  default     = "admin"
  sensitive   = true
}

# Network Configuration Variables
variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where RDS instances will be deployed"
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "List of security group IDs for RDS cluster"
}

# Backup and Maintenance Configuration
variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7
}

variable "preferred_backup_window" {
  type        = string
  description = "Daily time range during which automated backups are created"
  default     = "03:00-04:00"
}

variable "preferred_maintenance_window" {
  type        = string
  description = "Weekly time range during which system maintenance can occur"
  default     = "mon:04:00-mon:05:00"
}

# Security Configuration
variable "storage_encrypted" {
  type        = bool
  description = "Enable storage encryption using KMS"
  default     = true
}

variable "kms_key_id" {
  type        = string
  description = "ARN of KMS key for RDS encryption"
  default     = null
}

# Performance and Monitoring Configuration
variable "performance_insights_enabled" {
  type        = bool
  description = "Enable Performance Insights"
  default     = true
}

variable "performance_insights_retention_period" {
  type        = number
  description = "Amount of time in days to retain Performance Insights data"
  default     = 7
}

# Protection Configuration
variable "deletion_protection" {
  type        = bool
  description = "Enable deletion protection for the RDS cluster"
  default     = true
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Determines whether a final snapshot is created before deletion"
  default     = false
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all RDS resources"
  default     = {}
}