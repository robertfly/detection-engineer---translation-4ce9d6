// External dependencies
import Redis from 'ioredis'; // v5.3.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { createHash, createCipheriv, createDecipheriv } from 'crypto';

// Internal dependencies
import { createRedisClient, createRedisCluster } from '../config/redis';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Global constants
const DEFAULT_CACHE_TTL = 3600;
const RATE_LIMIT_PREFIX = 'rate_limit:';
const SESSION_PREFIX = 'session:';
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_TIMEOUT = 5000;
const ENCRYPTION_KEY_PREFIX = 'enc:';

// Interfaces
interface CacheOptions {
  ttl?: number;
  useCluster?: boolean;
  encrypt?: boolean;
  retryPolicy?: {
    maxRetries: number;
    backoff: number;
  };
  consistency?: 'strong' | 'eventual';
}

interface RedisService {
  client: Redis;
  clusterClient: Redis.Cluster;
  breaker: CircuitBreaker;
  pool: Map<string, Redis | Redis.Cluster>;
}

interface ConnectionPool {
  primary: Redis | Redis.Cluster;
  replicas: Array<Redis | Redis.Cluster>;
}

// Decorators
function circuitBreaker(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    return this.breaker.fire(async () => originalMethod.apply(this, args));
  };
  return descriptor;
}

function metrics(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const startTime = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      metrics.recordServiceMetric('redis', propertyKey, 'success', (Date.now() - startTime) / 1000);
      return result;
    } catch (error) {
      metrics.recordServiceMetric('redis', propertyKey, 'error', (Date.now() - startTime) / 1000);
      throw error;
    }
  };
  return descriptor;
}

// Main Redis Service Implementation
export class RedisServiceImpl implements RedisService {
  private readonly client: Redis;
  private readonly clusterClient: Redis.Cluster;
  private readonly breaker: CircuitBreaker;
  private readonly pool: Map<string, Redis | Redis.Cluster>;
  private readonly encryptionKey: Buffer;

  constructor() {
    this.client = createRedisClient();
    this.clusterClient = createRedisCluster({
      nodes: this.getClusterNodes(),
      enableReadReplicas: true,
      scaleReads: 3,
      maxRedirections: 16,
      clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
      clusterRequestTimeout: 5000,
      enableOfflineQueue: true
    });

    this.breaker = new CircuitBreaker(async () => {
      await this.healthCheck();
    }, {
      timeout: CIRCUIT_BREAKER_TIMEOUT,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    this.pool = new Map();
    this.initializeConnectionPool();
    this.setupEventListeners();
    this.encryptionKey = Buffer.from(process.env.REDIS_ENCRYPTION_KEY || '', 'hex');
  }

  private getClusterNodes(): Array<{ host: string; port: number }> {
    const nodesEnv = process.env.REDIS_CLUSTER_NODES || '';
    return nodesEnv.split(',').map(node => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port) };
    });
  }

  private initializeConnectionPool(): void {
    this.pool.set('primary', this.client);
    this.pool.set('cluster', this.clusterClient);
  }

  private setupEventListeners(): void {
    this.client.on('error', (err: Error) => {
      logger.error('Redis client error', err, {
        requestId: 'redis_error',
        service: 'redis_service',
        traceId: 'system',
        spanId: 'client_error',
        environment: process.env.NODE_ENV || 'development',
        userId: 'system'
      });
    });

    this.clusterClient.on('node error', (err: Error, node: { host: string; port: number }) => {
      logger.error(`Redis cluster node error: ${node.host}:${node.port}`, err, {
        requestId: 'redis_cluster_error',
        service: 'redis_service',
        traceId: 'system',
        spanId: 'cluster_error',
        environment: process.env.NODE_ENV || 'development',
        userId: 'system'
      });
    });
  }

  private async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getClient(options?: CacheOptions): Promise<Redis | Redis.Cluster> {
    if (options?.useCluster) {
      return this.clusterClient;
    }
    return this.client;
  }

  private encrypt(value: string): string {
    const iv = Buffer.alloc(16, 0);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${ENCRYPTION_KEY_PREFIX}${encrypted}`;
  }

  private decrypt(value: string): string {
    if (!value.startsWith(ENCRYPTION_KEY_PREFIX)) {
      return value;
    }
    const encrypted = value.slice(ENCRYPTION_KEY_PREFIX.length);
    const iv = Buffer.alloc(16, 0);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  @circuitBreaker
  @metrics
  public async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const client = await this.getClient(options);
      const ttl = options.ttl || DEFAULT_CACHE_TTL;
      const serializedValue = JSON.stringify(value);
      const finalValue = options.encrypt ? this.encrypt(serializedValue) : serializedValue;

      await client.set(key, finalValue, 'EX', ttl);
      return true;
    } catch (error) {
      logger.error('Redis set operation failed', error as Error, {
        requestId: 'redis_set_error',
        service: 'redis_service',
        traceId: 'system',
        spanId: 'set_error',
        environment: process.env.NODE_ENV || 'development',
        userId: 'system'
      });
      return false;
    }
  }

  @circuitBreaker
  @metrics
  public async get(key: string, options: CacheOptions = {}): Promise<any> {
    try {
      const client = await this.getClient(options);
      const value = await client.get(key);

      if (!value) {
        return null;
      }

      const decryptedValue = options.encrypt ? this.decrypt(value) : value;
      return JSON.parse(decryptedValue);
    } catch (error) {
      logger.error('Redis get operation failed', error as Error, {
        requestId: 'redis_get_error',
        service: 'redis_service',
        traceId: 'system',
        spanId: 'get_error',
        environment: process.env.NODE_ENV || 'development',
        userId: 'system'
      });
      return null;
    }
  }
}

// Export singleton instance
export const redisService = new RedisServiceImpl();
export default redisService;