# AWS VPC Configuration for Detection Translation Platform
# Module Version: terraform-aws-modules/vpc/aws v5.1.2

# Local variables for network configuration
locals {
  # Number of Availability Zones to use
  az_count = 3

  # CIDR blocks for private subnets (one per AZ)
  private_subnets = [
    "10.0.1.0/24",  # AZ-a: Services, EKS nodes
    "10.0.2.0/24",  # AZ-b: Services, EKS nodes
    "10.0.3.0/24"   # AZ-c: Services, EKS nodes
  ]

  # CIDR blocks for public subnets (one per AZ)
  public_subnets = [
    "10.0.101.0/24", # AZ-a: Load Balancers, NAT Gateways
    "10.0.102.0/24", # AZ-b: Load Balancers, NAT Gateways
    "10.0.103.0/24"  # AZ-c: Load Balancers, NAT Gateways
  ]

  # VPC Flow Logs retention period in days
  flow_log_retention_days = 90
}

# VPC Module Configuration
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  # Basic VPC Configuration
  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr

  # Availability Zone Configuration
  azs = [
    "${var.aws_region}a",
    "${var.aws_region}b",
    "${var.aws_region}c"
  ]

  # Subnet Configuration
  private_subnets     = local.private_subnets
  public_subnets      = local.public_subnets
  
  # NAT Gateway Configuration - One per AZ for high availability
  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  # DNS Configuration
  enable_dns_hostnames = true
  enable_dns_support   = true

  # VPN Configuration - Disabled as not required
  enable_vpn_gateway = false

  # VPC Flow Logs Configuration
  enable_flow_log                                = true
  create_flow_log_cloudwatch_log_group          = true
  create_flow_log_cloudwatch_iam_role           = true
  flow_log_max_aggregation_interval             = 60
  flow_log_retention_in_days                    = local.flow_log_retention_days

  # Resource Tags
  tags = merge(
    var.tags,
    {
      Terraform    = "true"
      Environment  = var.environment
      Project      = var.project_name
      NetworkTier  = "core"
    }
  )
}

# Output Definitions
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "nat_public_ips" {
  description = "List of public Elastic IPs created for AWS NAT Gateway"
  value       = module.vpc.nat_public_ips
}