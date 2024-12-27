// External dependencies
import Redis from 'ioredis'; // v5.3.0

// Internal dependencies
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Global constants for Redis configuration
const REDIS_KEY_PREFIX = 'api_gateway:';
const REDIS_CONNECT_TIMEOUT = 5000;
const REDIS_COMMAND_TIMEOUT = 2000;
const REDIS_MAX_RETRIES = 3;
const REDIS_MAX_CONNECTIONS = 50;
const REDIS_RETRY_INTERVAL = 100;
const REDIS_CLUSTER_SCALE_READS = 3;

// Interfaces for Redis configuration
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  enableTLS: boolean;
  maxRetriesPerRequest: number;
  connectTimeout: number;
  commandTimeout: number;
  maxConnections: number;
  enableReadyCheck: boolean;
  tlsOptions?: {
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  retryStrategy?: (times: number) => number | void;
  sentinelOptions?: {
    sentinels: Array<{ host: string; port: number }>;
    name: string;
  };
}

export interface RedisClusterConfig {
  nodes: Array<{ host: string; port: number }>;
  enableReadReplicas: boolean;
  scaleReads: number;
  maxRedirections: number;
  clusterRetryStrategy?: (times: number) => number | void;
  clusterRequestTimeout: number;
  enableOfflineQueue: boolean;
  natMap?: Record<string, { host: string; port: number }>;
}

// Default Redis configuration with security and performance options
const defaultRedisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: REDIS_KEY_PREFIX,
  enableTLS: process.env.REDIS_TLS === 'true',
  maxRetriesPerRequest: REDIS_MAX_RETRIES,
  connectTimeout: REDIS_CONNECT_TIMEOUT,
  commandTimeout: REDIS_COMMAND_TIMEOUT,
  maxConnections: REDIS_MAX_CONNECTIONS,
  enableReadyCheck: true,
  tlsOptions: process.env.REDIS_TLS === 'true' ? {
    rejectUnauthorized: true,
    ca: process.env.REDIS_TLS_CA,
    cert: process.env.REDIS_TLS_CERT,
    key: process.env.REDIS_TLS_KEY,
  } : undefined,
  retryStrategy: (times: number) => {
    if (times > REDIS_MAX_RETRIES) {
      return null;
    }
    return Math.min(times * REDIS_RETRY_INTERVAL, 2000);
  },
  enableOfflineQueue: true,
};

/**
 * Creates and configures a Redis client instance with comprehensive error handling and monitoring
 * @param config Redis configuration options
 * @returns Configured Redis client instance
 */
export const createRedisClient = (config: RedisConfig = defaultRedisConfig): Redis => {
  const redisClient = new Redis({
    ...config,
    lazyConnect: true,
    retryStrategy: config.retryStrategy,
    enableOfflineQueue: true,
  });

  // Set up event listeners for monitoring
  redisClient.on('connect', () => {
    logger.info('Redis client connected', {
      requestId: 'redis_connect',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'redis_connect',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
  });

  redisClient.on('error', (err: Error) => {
    logger.error('Redis client error', err, {
      requestId: 'redis_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'redis_error',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
    metrics.recordServiceMetric('redis', 'connection', 'error', 0, { healthScore: 0 });
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready', {
      requestId: 'redis_ready',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'redis_ready',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
    metrics.recordServiceMetric('redis', 'connection', 'ready', 0, { healthScore: 1 });
  });

  // Monitor command execution time
  redisClient.on('command', (command, args) => {
    const startTime = Date.now();
    redisClient.on('response', () => {
      const duration = (Date.now() - startTime) / 1000;
      metrics.recordServiceMetric('redis', command, 'success', duration);
    });
  });

  return redisClient;
};

/**
 * Creates and configures a Redis cluster client with high availability features
 * @param config Redis cluster configuration options
 * @returns Configured Redis cluster instance
 */
export const createRedisCluster = (config: RedisClusterConfig): Redis.Cluster => {
  const clusterClient = new Redis.Cluster(config.nodes, {
    scaleReads: config.enableReadReplicas ? 'slave' : 'master',
    clusterRetryStrategy: config.clusterRetryStrategy || ((times: number) => {
      if (times > REDIS_MAX_RETRIES) {
        return null;
      }
      return Math.min(times * REDIS_RETRY_INTERVAL, 2000);
    }),
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true' ? {
        rejectUnauthorized: true,
        ca: process.env.REDIS_TLS_CA,
        cert: process.env.REDIS_TLS_CERT,
        key: process.env.REDIS_TLS_KEY,
      } : undefined,
    },
    maxRedirections: config.maxRedirections,
    natMap: config.natMap,
  });

  // Set up cluster event monitoring
  clusterClient.on('node error', (err: Error, node: { host: string; port: number }) => {
    logger.error(`Redis cluster node error: ${node.host}:${node.port}`, err, {
      requestId: 'redis_cluster_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'cluster_error',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
    metrics.recordServiceMetric('redis_cluster', 'node_error', 'error', 0, { healthScore: 0.5 });
  });

  clusterClient.on('+node', (node: { host: string; port: number }) => {
    logger.info(`Redis cluster node added: ${node.host}:${node.port}`, {
      requestId: 'redis_cluster_node_added',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'cluster_node_added',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
  });

  return clusterClient;
};

// Export configuration and client creation functions
export const redisConfig = {
  host: defaultRedisConfig.host,
  port: defaultRedisConfig.port,
  keyPrefix: defaultRedisConfig.keyPrefix,
  tlsOptions: defaultRedisConfig.tlsOptions,
};

export default {
  createRedisClient,
  createRedisCluster,
  redisConfig,
};