// External dependencies
import * as amqplib from 'amqplib'; // ^0.10.3
import CircuitBreaker from 'opossum'; // ^7.1.0

// Internal dependencies
import { queueConfig, QueueNames } from '../config/queue';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Interfaces for queue operations
interface TranslationRequest {
  content: string;
  sourceFormat: string;
  targetFormat: string;
  requestId: string;
  userId: string;
  priority?: number;
}

interface BatchTranslationRequest {
  files: Array<{
    content: string;
    sourceFormat: string;
    filename: string;
  }>;
  targetFormat: string;
  batchId: string;
  userId: string;
  totalCount: number;
}

interface QueueStatus {
  isConnected: boolean;
  messageCount: {
    [key in QueueNames]: number;
  };
  consumerCount: {
    [key in QueueNames]: number;
  };
}

// Queue service interface
interface QueueService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publishTranslationRequest(request: TranslationRequest): Promise<void>;
  publishBatchRequest(request: BatchTranslationRequest): Promise<void>;
  getQueueStatus(): Promise<QueueStatus>;
  purgeQueue(queueName: QueueNames): Promise<void>;
}

/**
 * RabbitMQ service implementation with high availability and monitoring
 */
class RabbitMQService implements QueueService {
  private connection: amqplib.Connection | null = null;
  private channel: amqplib.Channel | null = null;
  private circuitBreaker: CircuitBreaker;
  private connectionRetryCount = 0;
  private isConnected = false;

  constructor() {
    // Configure circuit breaker for connection resilience
    this.circuitBreaker = new CircuitBreaker(
      async () => this.establishConnection(),
      {
        timeout: queueConfig.connection.connectionTimeout,
        resetTimeout: queueConfig.connection.retryDelay,
        errorThresholdPercentage: 50,
        volumeThreshold: 3,
      }
    );

    // Circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      logger.warn('Queue circuit breaker opened', {
        requestId: 'circuit_breaker',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'circuit_open',
        environment: process.env.NODE_ENV || 'development',
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Queue circuit breaker half-open', {
        requestId: 'circuit_breaker',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'circuit_half_open',
        environment: process.env.NODE_ENV || 'development',
      });
    });
  }

  /**
   * Establishes connection to RabbitMQ with retry logic
   */
  private async establishConnection(): Promise<void> {
    try {
      // Create connection
      this.connection = await amqplib.connect({
        hostname: queueConfig.connection.hostname,
        port: queueConfig.connection.port,
        username: queueConfig.connection.username,
        password: queueConfig.connection.password,
        vhost: queueConfig.connection.vhost,
        heartbeat: queueConfig.connection.heartbeat,
        ssl: queueConfig.connection.ssl,
      });

      // Create channel
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);

      // Assert queues
      for (const queueName of Object.values(QueueNames)) {
        await this.channel.assertQueue(queueName, queueConfig.options);
      }

      // Set up dead letter exchange
      await this.channel.assertExchange('dlx', 'direct', { durable: true });
      await this.channel.bindQueue(
        QueueNames.DEAD_LETTER_QUEUE,
        'dlx',
        QueueNames.DEAD_LETTER_QUEUE
      );

      // Connection event handlers
      this.connection.on('error', (err) => {
        logger.error('Queue connection error', err, {
          requestId: 'queue_error',
          service: 'queue_service',
          userId: 'system',
          traceId: 'system',
          spanId: 'connection_error',
          environment: process.env.NODE_ENV || 'development',
        });
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        this.isConnected = false;
        this.handleConnectionClose();
      });

      this.isConnected = true;
      this.connectionRetryCount = 0;

      logger.info('Successfully connected to RabbitMQ', {
        requestId: 'queue_connect',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'connect_success',
        environment: process.env.NODE_ENV || 'development',
      });

    } catch (err) {
      this.handleConnectionError(err as Error);
      throw err;
    }
  }

  /**
   * Handles connection errors with retry logic
   */
  private async handleConnectionError(err?: Error): Promise<void> {
    this.isConnected = false;
    if (err) {
      logger.error('Queue connection error', err, {
        requestId: 'queue_error',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'connection_error',
        environment: process.env.NODE_ENV || 'development',
      });
    }

    if (this.connectionRetryCount < queueConfig.connection.retryLimit) {
      this.connectionRetryCount++;
      setTimeout(() => this.connect(), queueConfig.connection.retryDelay);
    }
  }

  /**
   * Handles connection close events
   */
  private handleConnectionClose(): void {
    logger.warn('Queue connection closed', {
      requestId: 'queue_close',
      service: 'queue_service',
      userId: 'system',
      traceId: 'system',
      spanId: 'connection_close',
      environment: process.env.NODE_ENV || 'development',
    });
    this.connect();
  }

  /**
   * Connects to RabbitMQ using circuit breaker
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.circuitBreaker.fire();
      metrics.recordServiceMetric('queue_service', 'connect', 'success', 0);
    } catch (err) {
      metrics.recordServiceMetric('queue_service', 'connect', 'error', 0);
      throw err;
    }
  }

  /**
   * Gracefully disconnects from RabbitMQ
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      this.circuitBreaker.reset();

      logger.info('Disconnected from RabbitMQ', {
        requestId: 'queue_disconnect',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'disconnect',
        environment: process.env.NODE_ENV || 'development',
      });

      metrics.recordServiceMetric('queue_service', 'disconnect', 'success', 0);
    } catch (err) {
      metrics.recordServiceMetric('queue_service', 'disconnect', 'error', 0);
      throw err;
    }
  }

  /**
   * Publishes translation request to queue
   */
  public async publishTranslationRequest(request: TranslationRequest): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Queue service not connected');
    }

    const startTime = Date.now();
    try {
      const message = Buffer.from(JSON.stringify(request));
      await this.channel.publish(
        '',
        QueueNames.TRANSLATION_QUEUE,
        message,
        {
          persistent: true,
          priority: request.priority || 5,
          headers: {
            requestId: request.requestId,
            userId: request.userId,
            timestamp: new Date().toISOString(),
          },
        }
      );

      const duration = (Date.now() - startTime) / 1000;
      metrics.recordServiceMetric(
        'queue_service',
        'publish_translation',
        'success',
        duration
      );

      logger.info('Published translation request', {
        requestId: request.requestId,
        service: 'queue_service',
        userId: request.userId,
        traceId: 'system',
        spanId: 'publish_translation',
        environment: process.env.NODE_ENV || 'development',
      });
    } catch (err) {
      metrics.recordServiceMetric(
        'queue_service',
        'publish_translation',
        'error',
        (Date.now() - startTime) / 1000
      );
      throw err;
    }
  }

  /**
   * Publishes batch translation request to queue
   */
  public async publishBatchRequest(request: BatchTranslationRequest): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Queue service not connected');
    }

    const startTime = Date.now();
    try {
      const message = Buffer.from(JSON.stringify(request));
      await this.channel.publish(
        '',
        QueueNames.BATCH_QUEUE,
        message,
        {
          persistent: true,
          headers: {
            batchId: request.batchId,
            userId: request.userId,
            totalCount: request.totalCount,
            timestamp: new Date().toISOString(),
          },
        }
      );

      const duration = (Date.now() - startTime) / 1000;
      metrics.recordServiceMetric(
        'queue_service',
        'publish_batch',
        'success',
        duration
      );

      logger.info('Published batch translation request', {
        requestId: request.batchId,
        service: 'queue_service',
        userId: request.userId,
        traceId: 'system',
        spanId: 'publish_batch',
        environment: process.env.NODE_ENV || 'development',
      });
    } catch (err) {
      metrics.recordServiceMetric(
        'queue_service',
        'publish_batch',
        'error',
        (Date.now() - startTime) / 1000
      );
      throw err;
    }
  }

  /**
   * Gets current queue status
   */
  public async getQueueStatus(): Promise<QueueStatus> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Queue service not connected');
    }

    const status: QueueStatus = {
      isConnected: this.isConnected,
      messageCount: {} as { [key in QueueNames]: number },
      consumerCount: {} as { [key in QueueNames]: number },
    };

    try {
      for (const queueName of Object.values(QueueNames)) {
        const queueInfo = await this.channel.checkQueue(queueName);
        status.messageCount[queueName] = queueInfo.messageCount;
        status.consumerCount[queueName] = queueInfo.consumerCount;
      }
      return status;
    } catch (err) {
      logger.error('Failed to get queue status', err as Error, {
        requestId: 'queue_status',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'get_status',
        environment: process.env.NODE_ENV || 'development',
      });
      throw err;
    }
  }

  /**
   * Purges specified queue
   */
  public async purgeQueue(queueName: QueueNames): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Queue service not connected');
    }

    try {
      await this.channel.purgeQueue(queueName);
      logger.info(`Purged queue ${queueName}`, {
        requestId: 'queue_purge',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'purge_queue',
        environment: process.env.NODE_ENV || 'development',
      });
    } catch (err) {
      logger.error(`Failed to purge queue ${queueName}`, err as Error, {
        requestId: 'queue_purge_error',
        service: 'queue_service',
        userId: 'system',
        traceId: 'system',
        spanId: 'purge_queue',
        environment: process.env.NODE_ENV || 'development',
      });
      throw err;
    }
  }
}

// Export singleton instance
export const queueService = new RabbitMQService();