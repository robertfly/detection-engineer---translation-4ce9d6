"""
RabbitMQ Queue Configuration Module

Version: 1.0.0
Description: Production-ready RabbitMQ configuration for Translation Service with support for
clustering, high availability, and secure connection management.

External Dependencies:
- os (Python 3.11+): Environment variable management
- dataclasses (Python 3.11+): Type-safe configuration classes
- typing (Python 3.11+): Type hint support
"""

import os
import re
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional

# Queue name constants for different translation operations
QUEUE_NAMES = {
    'TRANSLATION_QUEUE': 'translation_queue',
    'BATCH_QUEUE': 'batch_queue',
    'VALIDATION_QUEUE': 'validation_queue'
}

# Production-ready default queue options with optimized settings
DEFAULT_QUEUE_OPTIONS = {
    'message_ttl': 3600000,  # 1 hour message TTL
    'durable': True,  # Survive broker restarts
    'auto_delete': False,  # Don't delete when consumers are gone
    'max_priority': 10,  # Support priority levels 0-10
    'x-queue-mode': 'lazy',  # Optimize for high-volume queues
    'x-max-length': 100000,  # Maximum queue length
    'x-overflow': 'reject-publish'  # Reject new messages when queue is full
}

@dataclass
class QueueConfig:
    """
    Comprehensive RabbitMQ configuration class with support for clustering,
    SSL, and high availability settings.
    """
    host: str
    port: int
    username: str
    password: str
    vhost: str
    heartbeat: int
    ssl_enabled: bool
    ssl_cert_path: str
    ssl_key_path: str
    ssl_ca_path: str
    connection_timeout: int
    channel_prefetch: int
    connection_attempts: int
    queue_options: Dict
    cluster_nodes: List[str]
    ha_enabled: bool
    pool_size: int

    def __init__(self):
        """
        Initialize queue configuration with secure environment variables
        and production-ready defaults.
        """
        self.host = os.getenv('RABBITMQ_HOST', 'localhost')
        self.port = int(os.getenv('RABBITMQ_PORT', '5672'))
        self.username = os.getenv('RABBITMQ_USER', 'guest')
        self.password = os.getenv('RABBITMQ_PASSWORD', 'guest')
        self.vhost = os.getenv('RABBITMQ_VHOST', '/')
        self.heartbeat = 60  # 60 seconds heartbeat
        
        # SSL Configuration
        self.ssl_enabled = os.getenv('RABBITMQ_SSL_ENABLED', 'false').lower() == 'true'
        self.ssl_cert_path = os.getenv('RABBITMQ_SSL_CERT_PATH', '')
        self.ssl_key_path = os.getenv('RABBITMQ_SSL_KEY_PATH', '')
        self.ssl_ca_path = os.getenv('RABBITMQ_SSL_CA_PATH', '')
        
        # Connection Settings
        self.connection_timeout = 30  # 30 seconds timeout
        self.channel_prefetch = 100  # Process up to 100 messages per consumer
        self.connection_attempts = 3  # Retry connection 3 times
        
        # Queue Options
        self.queue_options = DEFAULT_QUEUE_OPTIONS.copy()
        
        # Cluster Configuration
        cluster_nodes_str = os.getenv('RABBITMQ_CLUSTER_NODES', '')
        self.cluster_nodes = [node.strip() for node in cluster_nodes_str.split(',') if node.strip()]
        
        # High Availability Settings
        self.ha_enabled = os.getenv('RABBITMQ_HA_ENABLED', 'true').lower() == 'true'
        
        # Connection Pool
        self.pool_size = int(os.getenv('RABBITMQ_POOL_SIZE', '10'))

    def validate(self) -> Tuple[bool, List[str]]:
        """
        Comprehensive validation of queue configuration parameters.
        
        Returns:
            Tuple[bool, List[str]]: Validation result and list of validation errors
        """
        errors = []
        
        # Host validation
        if not self.host:
            errors.append("Host cannot be empty")
        elif not re.match(r'^[a-zA-Z0-9.-]+$', self.host):
            errors.append("Invalid host format")
            
        # Port validation
        if not 1 <= self.port <= 65535:
            errors.append("Port must be between 1 and 65535")
            
        # Credential validation
        if not self.username or not self.password:
            errors.append("Username and password must be provided")
            
        # VHost validation
        if not self.vhost.startswith('/'):
            errors.append("VHost must start with '/'")
            
        # Heartbeat validation
        if not 0 <= self.heartbeat <= 600:
            errors.append("Heartbeat must be between 0 and 600 seconds")
            
        # SSL validation
        if self.ssl_enabled:
            if not all([self.ssl_cert_path, self.ssl_key_path, self.ssl_ca_path]):
                errors.append("SSL certificates must be provided when SSL is enabled")
            for path in [self.ssl_cert_path, self.ssl_key_path, self.ssl_ca_path]:
                if path and not os.path.exists(path):
                    errors.append(f"SSL certificate path does not exist: {path}")
                    
        # Connection settings validation
        if self.connection_timeout <= 0:
            errors.append("Connection timeout must be positive")
        if self.channel_prefetch <= 0:
            errors.append("Channel prefetch must be positive")
        if self.connection_attempts <= 0:
            errors.append("Connection attempts must be positive")
            
        # Pool size validation
        if not 1 <= self.pool_size <= 100:
            errors.append("Pool size must be between 1 and 100")
            
        return len(errors) == 0, errors

    def get_connection_params(self) -> Dict:
        """
        Returns production-ready connection parameters for RabbitMQ client.
        
        Returns:
            Dict: Comprehensive connection parameters dictionary
        """
        params = {
            'host': self.host,
            'port': self.port,
            'virtual_host': self.vhost,
            'credentials': {
                'username': self.username,
                'password': self.password
            },
            'connection_parameters': {
                'heartbeat': self.heartbeat,
                'connection_timeout': self.connection_timeout,
                'retry_delay': 2.0,
                'socket_timeout': 5.0,
                'stack_timeout': 5.0,
                'channel_max': 2047,
                'frame_max': 131072,
                'locale': 'en_US'
            },
            'channel_parameters': {
                'prefetch_count': self.channel_prefetch,
                'prefetch_size': 0
            }
        }

        # SSL Configuration
        if self.ssl_enabled:
            params['ssl_options'] = {
                'cert_reqs': 2,  # ssl.CERT_REQUIRED
                'ca_certs': self.ssl_ca_path,
                'certfile': self.ssl_cert_path,
                'keyfile': self.ssl_key_path,
                'verify_mode': 'required'
            }

        # Cluster Configuration
        if self.cluster_nodes:
            params['cluster'] = {
                'nodes': self.cluster_nodes,
                'retry_delay': 1.0,
                'retry_attempts': self.connection_attempts
            }

        # High Availability Settings
        if self.ha_enabled:
            params['ha_settings'] = {
                'ha-mode': 'all',
                'ha-sync-mode': 'automatic',
                'ha-promote-on-shutdown': 'always'
            }

        # Connection Pool Settings
        params['pool'] = {
            'max_size': self.pool_size,
            'max_overflow': 2,
            'timeout': 30,
            'recycle': 3600
        }

        return params