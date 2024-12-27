// External dependencies
import mongoose from 'mongoose'; // v7.6.3
import { info, error, warn } from '../utils/logger';

// Interfaces
export interface DatabaseConfig {
  uri: string;
  dbName: string;
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  connectTimeoutMS: number;
  serverSelectionTimeoutMS: number;
  heartbeatFrequencyMS: number;
  retryWrites: boolean;
  ssl: boolean;
  sslOptions?: {
    rejectUnauthorized: boolean;
    ca?: string[];
  };
  replicaSet?: {
    enabled: boolean;
    name?: string;
    readPreference?: string;
  };
  monitoring?: {
    enabled: boolean;
    intervalMS: number;
    detailedLogs: boolean;
  };
}

export interface ConnectionMetrics {
  activeConnections: number;
  availableConnections: number;
  pendingConnections: number;
  totalOperations: number;
  connectionLatency: {
    min: number;
    max: number;
    avg: number;
  };
}

// Global constants
const DEFAULT_DB_NAME = 'detection_translator';
const DEFAULT_MAX_POOL_SIZE = 10;
const DEFAULT_MIN_POOL_SIZE = 2;
const DEFAULT_MAX_IDLE_TIME_MS = 60000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 30000;
const DEFAULT_HEARTBEAT_FREQUENCY_MS = 10000;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_INTERVAL_MS = 5000;

// Default configuration with security and performance optimizations
export const defaultConfig: DatabaseConfig = {
  dbName: process.env.DB_NAME || DEFAULT_DB_NAME,
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE!) || DEFAULT_MAX_POOL_SIZE,
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE!) || DEFAULT_MIN_POOL_SIZE,
  maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME_MS!) || DEFAULT_MAX_IDLE_TIME_MS,
  connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT_MS!) || DEFAULT_CONNECT_TIMEOUT_MS,
  serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS!) || DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY_MS!) || DEFAULT_HEARTBEAT_FREQUENCY_MS,
  retryWrites: true,
  ssl: process.env.NODE_ENV === 'production',
  sslOptions: {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA ? [process.env.DB_SSL_CA] : undefined,
  },
  replicaSet: {
    enabled: process.env.DB_REPLICA_SET_ENABLED === 'true',
    name: process.env.DB_REPLICA_SET_NAME,
    readPreference: process.env.DB_READ_PREFERENCE || 'primaryPreferred',
  },
  monitoring: {
    enabled: true,
    intervalMS: 5000,
    detailedLogs: process.env.NODE_ENV !== 'production',
  },
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
};

// Metrics storage
let connectionMetrics: ConnectionMetrics = {
  activeConnections: 0,
  availableConnections: 0,
  pendingConnections: 0,
  totalOperations: 0,
  connectionLatency: {
    min: 0,
    max: 0,
    avg: 0,
  },
};

/**
 * Creates and configures MongoDB connection with advanced retry logic and monitoring
 * @param config Database configuration options
 * @returns Promise<mongoose.Connection>
 */
export async function createDatabaseConnection(
  config: DatabaseConfig = defaultConfig
): Promise<mongoose.Connection> {
  let retryAttempts = 0;
  let connected = false;

  // Configure mongoose settings
  mongoose.set('strictQuery', true);
  mongoose.set('debug', config.monitoring?.detailedLogs || false);

  // Connection options
  const mongooseOptions: mongoose.ConnectOptions = {
    dbName: config.dbName,
    maxPoolSize: config.maxPoolSize,
    minPoolSize: config.minPoolSize,
    maxIdleTimeMS: config.maxIdleTimeMS,
    connectTimeoutMS: config.connectTimeoutMS,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    heartbeatFrequencyMS: config.heartbeatFrequencyMS,
    retryWrites: config.retryWrites,
    ssl: config.ssl,
    sslCA: config.sslOptions?.ca,
    replicaSet: config.replicaSet?.enabled ? config.replicaSet.name : undefined,
    readPreference: config.replicaSet?.readPreference as mongoose.ReadPreferenceMode,
  };

  // Connection retry logic with exponential backoff
  while (!connected && retryAttempts < MAX_RETRY_ATTEMPTS) {
    try {
      const startTime = Date.now();
      await mongoose.connect(config.uri, mongooseOptions);
      const connectionTime = Date.now() - startTime;
      
      // Update connection latency metrics
      updateConnectionLatencyMetrics(connectionTime);
      connected = true;

      info('Database connection established successfully', {
        requestId: 'db-connect',
        userId: 'system',
        service: 'api-gateway',
        traceId: 'db-connection',
        spanId: `attempt-${retryAttempts}`,
        environment: process.env.NODE_ENV || 'development',
        metadata: {
          attempt: retryAttempts + 1,
          connectionTime,
        },
      });
    } catch (err) {
      retryAttempts++;
      const nextRetryDelay = RETRY_INTERVAL_MS * Math.pow(2, retryAttempts - 1);

      error(
        `Database connection attempt ${retryAttempts} failed. Retrying in ${nextRetryDelay}ms`,
        err as Error,
        {
          requestId: 'db-connect',
          userId: 'system',
          service: 'api-gateway',
          traceId: 'db-connection',
          spanId: `attempt-${retryAttempts}`,
          environment: process.env.NODE_ENV || 'development',
        }
      );

      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, nextRetryDelay));
      }
    }
  }

  if (!connected) {
    throw new Error(`Failed to connect to database after ${MAX_RETRY_ATTEMPTS} attempts`);
  }

  // Set up connection monitoring
  setupConnectionMonitoring(config);

  // Set up connection event handlers
  setupConnectionEventHandlers();

  return mongoose.connection;
}

/**
 * Gracefully closes database connection with resource cleanup
 * @returns Promise<void>
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close(true);
      info('Database connection closed successfully', {
        requestId: 'db-close',
        userId: 'system',
        service: 'api-gateway',
        traceId: 'db-connection',
        spanId: 'connection-close',
        environment: process.env.NODE_ENV || 'development',
      });
    }
  } catch (err) {
    error('Error closing database connection', err as Error, {
      requestId: 'db-close',
      userId: 'system',
      service: 'api-gateway',
      traceId: 'db-connection',
      spanId: 'connection-close',
      environment: process.env.NODE_ENV || 'development',
    });
    throw err;
  }
}

/**
 * Retrieves current connection pool metrics and performance statistics
 * @returns Promise<ConnectionMetrics>
 */
export async function getConnectionMetrics(): Promise<ConnectionMetrics> {
  return connectionMetrics;
}

// Helper functions
function setupConnectionMonitoring(config: DatabaseConfig): void {
  if (config.monitoring?.enabled) {
    setInterval(() => {
      const conn = mongoose.connection;
      connectionMetrics = {
        ...connectionMetrics,
        activeConnections: conn.active,
        availableConnections: conn.available,
        pendingConnections: conn.pending,
        totalOperations: conn.totalSocketHandlers,
      };

      if (config.monitoring.detailedLogs) {
        info('Database connection metrics', {
          requestId: 'db-metrics',
          userId: 'system',
          service: 'api-gateway',
          traceId: 'db-monitoring',
          spanId: 'metrics-collection',
          environment: process.env.NODE_ENV || 'development',
          metadata: connectionMetrics,
        });
      }
    }, config.monitoring.intervalMS);
  }
}

function setupConnectionEventHandlers(): void {
  const conn = mongoose.connection;

  conn.on('error', (err) => {
    error('Database connection error', err, {
      requestId: 'db-event',
      userId: 'system',
      service: 'api-gateway',
      traceId: 'db-connection',
      spanId: 'connection-error',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  conn.on('disconnected', () => {
    warn('Database disconnected', {
      requestId: 'db-event',
      userId: 'system',
      service: 'api-gateway',
      traceId: 'db-connection',
      spanId: 'connection-disconnected',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  conn.on('reconnected', () => {
    info('Database reconnected', {
      requestId: 'db-event',
      userId: 'system',
      service: 'api-gateway',
      traceId: 'db-connection',
      spanId: 'connection-reconnected',
      environment: process.env.NODE_ENV || 'development',
    });
  });
}

function updateConnectionLatencyMetrics(latency: number): void {
  connectionMetrics.connectionLatency.min = Math.min(
    connectionMetrics.connectionLatency.min || latency,
    latency
  );
  connectionMetrics.connectionLatency.max = Math.max(
    connectionMetrics.connectionLatency.max,
    latency
  );
  connectionMetrics.connectionLatency.avg =
    (connectionMetrics.connectionLatency.avg + latency) / 2;
}