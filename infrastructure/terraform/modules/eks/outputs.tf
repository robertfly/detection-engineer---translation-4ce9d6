# EKS Cluster Outputs
output "cluster_id" {
  description = "The unique identifier of the EKS cluster for cluster management and operations"
  value       = aws_eks_cluster.main.id
  sensitive   = false
}

output "cluster_endpoint" {
  description = "The secure HTTPS endpoint URL for the EKS cluster API server, used for cluster administration and workload management"
  value       = aws_eks_cluster.main.endpoint
  sensitive   = true # Marked sensitive as it contains internal endpoint information
}

output "cluster_certificate_authority" {
  description = "The base64 encoded certificate data required for secure communication with the EKS cluster API server"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true # Marked sensitive as it contains security credentials
}

# Security Group Outputs
output "cluster_security_group_id" {
  description = "The ID of the security group controlling network access to the EKS cluster control plane"
  value       = aws_security_group.eks_cluster.id
  sensitive   = false
}

output "node_security_group_id" {
  description = "The ID of the security group controlling network access between EKS worker nodes and the control plane"
  value       = aws_security_group.eks_nodes.id
  sensitive   = false
}

# IAM Role Outputs
output "cluster_iam_role_arn" {
  description = "The ARN of the IAM role used by the EKS cluster for API operations and service integration"
  value       = aws_iam_role.eks_cluster.arn
  sensitive   = false
}

output "node_iam_role_arn" {
  description = "The ARN of the IAM role used by EKS worker nodes for AWS service access and container operations"
  value       = aws_iam_role.eks_nodes.arn
  sensitive   = false
}