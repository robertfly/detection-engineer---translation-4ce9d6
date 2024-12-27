// External dependencies
import * as grpc from '@grpc/grpc-js'; // v1.9.0
import * as protoLoader from '@grpc/proto-loader'; // v0.7.0

// Internal dependencies
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Global configuration constants
export const DEFAULT_SERVICE_TIMEOUT = 10000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_SECURE = process.env.NODE_ENV === 'production';
export const DEFAULT_HEALTH_CHECK_INTERVAL = 30000;
export const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;

// Service configuration interfaces
export interface ServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  timeout: number;
  maxRetries: number;
  tls: TLSConfig;
  healthCheck: HealthCheckConfig;
  circuitBreaker: {
    threshold: number;
    resetTimeout: number;
  };
  discovery: {
    enabled: boolean;
    serviceName: string;
    namespace: string;
  };
}

export interface TLSConfig {
  certPath: string;
  keyPath: string;
  caPath: string;
  rejectUnauthorized: boolean;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
}

// Default service configurations
export const defaultServicesConfig = {
  translationService: {
    host: process.env.TRANSLATION_SERVICE_HOST || 'translation-service',
    port: parseInt(process.env.TRANSLATION_SERVICE_PORT || '50051'),
    secure: DEFAULT_SECURE,
    timeout: DEFAULT_SERVICE_TIMEOUT,
    maxRetries: DEFAULT_MAX_RETRIES,
    tls: {
      certPath: process.env.TRANSLATION_SERVICE_CERT_PATH,
      keyPath: process.env.TRANSLATION_SERVICE_KEY_PATH,
      caPath: process.env.TRANSLATION_SERVICE_CA_PATH,
      rejectUnauthorized: true
    },
    healthCheck: {
      endpoint: '/health',
      interval: DEFAULT_HEALTH_CHECK_INTERVAL,
      timeout: 5000,
      unhealthyThreshold: 3
    },
    circuitBreaker: {
      threshold: DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: 30000
    },
    discovery: {
      enabled: true,
      serviceName: 'translation-service',
      namespace: 'default'
    }
  },
  validationService: {
    host: process.env.VALIDATION_SERVICE_HOST || 'validation-service',
    port: parseInt(process.env.VALIDATION_SERVICE_PORT || '50052'),
    secure: DEFAULT_SECURE,
    timeout: DEFAULT_SERVICE_TIMEOUT,
    maxRetries: DEFAULT_MAX_RETRIES,
    tls: {
      certPath: process.env.VALIDATION_SERVICE_CERT_PATH,
      keyPath: process.env.VALIDATION_SERVICE_KEY_PATH,
      caPath: process.env.VALIDATION_SERVICE_CA_PATH,
      rejectUnauthorized: true
    },
    healthCheck: {
      endpoint: '/health',
      interval: DEFAULT_HEALTH_CHECK_INTERVAL,
      timeout: 5000,
      unhealthyThreshold: 3
    },
    circuitBreaker: {
      threshold: DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: 30000
    },
    discovery: {
      enabled: true,
      serviceName: 'validation-service',
      namespace: 'default'
    }
  }
};

/**
 * Validates service configuration including security settings
 * @param config Service configuration to validate
 * @returns Validation result with detailed checks
 */
export const validateServiceConfig = (config: ServiceConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Basic configuration validation
  if (!config.host) errors.push('Service host is required');
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Invalid service port');
  }

  // Security validation for production
  if (process.env.NODE_ENV === 'production') {
    if (!config.secure) {
      errors.push('Secure communication is required in production');
    }
    if (config.secure && (!config.tls.certPath || !config.tls.keyPath)) {
      errors.push('TLS certificates are required for secure communication');
    }
  }

  // Health check validation
  if (config.healthCheck) {
    if (!config.healthCheck.endpoint) errors.push('Health check endpoint is required');
    if (config.healthCheck.interval < 1000) {
      errors.push('Health check interval must be at least 1 second');
    }
  }

  // Circuit breaker validation
  if (config.circuitBreaker) {
    if (config.circuitBreaker.threshold < 1) {
      errors.push('Circuit breaker threshold must be positive');
    }
    if (config.circuitBreaker.resetTimeout < 1000) {
      errors.push('Circuit breaker reset timeout must be at least 1 second');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Creates and configures a secure gRPC client with enhanced error handling and monitoring
 * @param config Service configuration
 * @param protoPath Path to protocol buffer definition
 * @param options Additional gRPC options
 * @returns Configured gRPC client instance
 */
export const createServiceClient = (
  config: ServiceConfig,
  protoPath: string,
  options: grpc.ClientOptions = {}
): grpc.Client => {
  // Validate configuration
  const validation = validateServiceConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid service configuration: ${validation.errors.join(', ')}`);
  }

  // Load protocol buffer
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  // Configure security credentials
  let credentials: grpc.ChannelCredentials;
  if (config.secure) {
    try {
      credentials = grpc.credentials.createSsl(
        config.tls.caPath ? Buffer.from(config.tls.caPath) : undefined,
        config.tls.keyPath ? Buffer.from(config.tls.keyPath) : undefined,
        config.tls.certPath ? Buffer.from(config.tls.certPath) : undefined
      );
    } catch (error) {
      logger.error('Failed to create SSL credentials', error as Error, {
        requestId: 'create_client',
        service: config.discovery.serviceName,
        userId: 'system',
        traceId: 'system',
        spanId: 'create_credentials',
        environment: process.env.NODE_ENV || 'development'
      });
      throw error;
    }
  } else {
    credentials = grpc.credentials.createInsecure();
  }

  // Configure client options with timeouts and monitoring
  const clientOptions: grpc.ClientOptions = {
    'grpc.max_receive_message_length': 1024 * 1024 * 100, // 100MB
    'grpc.max_send_message_length': 1024 * 1024 * 100, // 100MB
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 10000,
    'grpc.http2.min_time_between_pings_ms': 10000,
    'grpc.http2.max_pings_without_data': 0,
    ...options
  };

  // Create client instance
  const client = new grpc.Client(
    `${config.host}:${config.port}`,
    credentials,
    clientOptions
  );

  // Configure health monitoring
  let unhealthyCount = 0;
  const healthCheck = setInterval(() => {
    client.getChannel().getConnectivityState(true);
    const state = client.getChannel().getConnectivityState(false);
    
    metrics.recordServiceMetric(
      config.discovery.serviceName,
      'health_check',
      state.toString(),
      0,
      {
        healthScore: state === grpc.connectivityState.READY ? 1 : 0
      }
    );

    if (state !== grpc.connectivityState.READY) {
      unhealthyCount++;
      if (unhealthyCount >= config.healthCheck.unhealthyThreshold) {
        logger.error(`Service ${config.discovery.serviceName} is unhealthy`, new Error('Health check failed'), {
          requestId: 'health_check',
          service: config.discovery.serviceName,
          userId: 'system',
          traceId: 'system',
          spanId: 'health_check',
          environment: process.env.NODE_ENV || 'development'
        });
      }
    } else {
      unhealthyCount = 0;
    }
  }, config.healthCheck.interval);

  // Clean up on client destruction
  client.on('close', () => {
    clearInterval(healthCheck);
  });

  return client;
};

// Export service configurations and utilities
export const servicesConfig = {
  translationService: defaultServicesConfig.translationService,
  validationService: defaultServicesConfig.validationService
};

export default {
  servicesConfig,
  createServiceClient,
  validateServiceConfig
};