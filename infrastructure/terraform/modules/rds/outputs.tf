# RDS Cluster Endpoint - Primary connection endpoint for the database
output "cluster_endpoint" {
  description = "The connection endpoint for the RDS cluster"
  value       = aws_rds_cluster.main.endpoint
  sensitive   = false
}

# RDS Cluster Identifier - Unique identifier for the cluster
output "cluster_identifier" {
  description = "The identifier of the RDS cluster"
  value       = aws_rds_cluster.main.cluster_identifier
  sensitive   = false
}

# RDS Cluster Port - Port number for database connections
output "cluster_port" {
  description = "The port number on which the RDS cluster accepts connections"
  value       = aws_rds_cluster.main.port
  sensitive   = false
}

# RDS Master Username - Admin username for database authentication
output "cluster_master_username" {
  description = "The master username for the RDS cluster"
  value       = aws_rds_cluster.main.master_username
  sensitive   = true # Marked sensitive to prevent exposure in logs
}

# RDS Database Name - Default database name
output "cluster_database_name" {
  description = "The name of the default database created in the RDS cluster"
  value       = aws_rds_cluster.main.database_name
  sensitive   = false
}

# RDS Cluster Instances - List of instance identifiers in the cluster
output "cluster_instances" {
  description = "The list of cluster instance identifiers"
  value       = [for instance in aws_rds_cluster_instance.main : instance.identifier]
  sensitive   = false
}

# RDS Reader Endpoint - Endpoint for read replicas
output "reader_endpoint" {
  description = "A read-only endpoint for the Aurora cluster, automatically load-balanced across replicas"
  value       = aws_rds_cluster.main.reader_endpoint
  sensitive   = false
}

# RDS Cluster ARN - Amazon Resource Name for the cluster
output "cluster_arn" {
  description = "The ARN of the RDS cluster"
  value       = aws_rds_cluster.main.arn
  sensitive   = false
}

# RDS Cluster Status - Current status of the cluster
output "cluster_status" {
  description = "Current status of the RDS cluster"
  value       = aws_rds_cluster.main.status
  sensitive   = false
}