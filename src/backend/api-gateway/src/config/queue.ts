// @package amqplib ^0.10.3
import { Options } from 'amqplib';

/**
 * Interface defining comprehensive RabbitMQ connection configuration
 * with security and monitoring options
 */
interface QueueConfig {
  hostname: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
  heartbeat: number;
  ssl: boolean;
  connectionTimeout: number;
  retryLimit: number;
  retryDelay: number;
}

/**
 * Interface for queue monitoring configuration
 */
interface MonitoringConfig {
  queueDepthLimit: number;
  queueDepthWarning: number;
  processingTimeout: number;
}

/**
 * Enum containing standardized queue names for different operations
 * including dead letter queue
 */
export enum QueueNames {
  TRANSLATION_QUEUE = 'translation_queue',
  BATCH_QUEUE = 'batch_queue',
  VALIDATION_QUEUE = 'validation_queue',
  DEAD_LETTER_QUEUE = 'dead_letter_queue'
}

/**
 * Comprehensive RabbitMQ configuration including connection parameters,
 * queue options, and monitoring settings
 */
export const queueConfig = {
  /**
   * RabbitMQ connection configuration with fallback values
   * and security settings
   */
  connection: {
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    vhost: process.env.RABBITMQ_VHOST || '/',
    heartbeat: 60,
    ssl: process.env.RABBITMQ_SSL === 'true',
    connectionTimeout: 30000, // 30 seconds
    retryLimit: 5,
    retryDelay: 5000 // 5 seconds
  } as QueueConfig,

  /**
   * Queue assertion options with durability, message TTL,
   * and dead letter configuration
   */
  options: {
    durable: true, // Survive broker restarts
    autoDelete: false, // Don't delete when consumers are gone
    arguments: {
      messageTtl: 86400000, // 24 hours in milliseconds
      maxLength: 10000, // Maximum number of messages
      deadLetterExchange: 'dlx', // Dead letter exchange
      deadLetterRoutingKey: 'dead_letter_queue',
      maxPriority: 10 // Enable message priority (1-10)
    }
  } as Options.AssertQueue,

  /**
   * Monitoring configuration for queue health
   * and performance tracking
   */
  monitoring: {
    queueDepthLimit: 8000, // Critical threshold for queue depth
    queueDepthWarning: 5000, // Warning threshold for queue depth
    processingTimeout: 300000 // 5 minutes processing timeout
  } as MonitoringConfig
};

/**
 * Re-export specific configuration objects for external use
 */
export const { connection, options, monitoring } = queueConfig;