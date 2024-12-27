# AWS Provider version ~> 5.0

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster following organizational naming conventions"

  validation {
    condition     = length(var.cluster_name) <= 100 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be 100 characters or less and start with a letter, containing only alphanumeric characters and hyphens"
  }
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster (must be supported by AWS EKS)"
  default     = "1.28"

  validation {
    condition     = can(regex("^1\\.(2[4-8])$", var.cluster_version))
    error_message = "Kubernetes version must be between 1.24 and 1.28"
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where EKS cluster will be deployed"

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid and start with 'vpc-'"
  }
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for EKS worker nodes (minimum 2 subnets in different AZs)"

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets must be provided for high availability"
  }
}

variable "node_instance_types" {
  type        = list(string)
  description = "List of EC2 instance types for EKS worker nodes"
  default     = ["r6g.2xlarge"]

  validation {
    condition     = can(index(var.node_instance_types, "r6g.2xlarge"))
    error_message = "r6g.2xlarge must be included in instance types for production workloads"
  }
}

variable "node_group_name" {
  type        = string
  description = "Name prefix for the EKS node group"
  default     = "production"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.node_group_name))
    error_message = "Node group name must start with a letter and contain only alphanumeric characters and hyphens"
  }
}

variable "min_size" {
  type        = number
  description = "Minimum number of worker nodes for auto-scaling"
  default     = 2

  validation {
    condition     = var.min_size >= 2
    error_message = "Minimum size must be at least 2 for high availability"
  }
}

variable "max_size" {
  type        = number
  description = "Maximum number of worker nodes for auto-scaling"
  default     = 10

  validation {
    condition     = var.max_size <= 10
    error_message = "Maximum size cannot exceed 10 nodes"
  }
}

variable "desired_size" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 2

  validation {
    condition     = var.desired_size >= var.min_size && var.desired_size <= var.max_size
    error_message = "Desired size must be between min_size and max_size"
  }
}

variable "disk_size" {
  type        = number
  description = "Disk size in GB for worker nodes"
  default     = 100

  validation {
    condition     = var.disk_size >= 100
    error_message = "Disk size must be at least 100GB for production workloads"
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all EKS resources"
  default     = {}

  validation {
    condition     = can(lookup(var.tags, "Environment", null))
    error_message = "Tags must include an Environment tag"
  }
}