// External dependencies
import winston from 'winston'; // v3.10.0
import ecsFormat from '@elastic/ecs-winston-format'; // v1.3.1
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1

// Define log levels with numeric priorities
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
} as const;

// Environment-based configuration defaults
export const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const MAX_LOG_SIZE = process.env.MAX_LOG_SIZE || '100m';
export const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS || '30';

// Interface for structured log context
export interface LogContext {
  requestId: string;
  userId: string;
  service: string;
  traceId: string;
  spanId: string;
  environment: string;
  metadata?: any;
}

// Extended logger configuration interface
export interface LoggerConfig {
  level: string;
  console: boolean;
  file: boolean;
  filename: string;
  maxSize: number | string;
  maxFiles: number | string;
  compress: boolean;
  elkEndpoint?: string;
  sanitizeLogs: boolean;
  sampleRate: number;
}

// Default logger configuration
export const defaultLoggerConfig: LoggerConfig = {
  level: DEFAULT_LOG_LEVEL,
  console: true,
  file: process.env.NODE_ENV === 'production',
  filename: 'logs/api-gateway-%DATE%.log',
  maxSize: MAX_LOG_SIZE,
  maxFiles: LOG_RETENTION_DAYS,
  compress: true,
  elkEndpoint: process.env.ELK_ENDPOINT,
  sanitizeLogs: true,
  sampleRate: 1.0,
};

/**
 * Sanitizes sensitive information from log messages
 * @param message The message to sanitize
 * @returns Sanitized message
 */
const sanitizeLogMessage = (message: any): any => {
  if (typeof message === 'string') {
    // Remove potential sensitive data patterns
    return message.replace(/password=[\w\d]+/gi, 'password=[REDACTED]')
                 .replace(/authorization:\s*bearer\s+[\w\d-.]+/gi, 'authorization: bearer [REDACTED]')
                 .replace(/token=[\w\d-.]+/gi, 'token=[REDACTED]');
  }
  return message;
};

/**
 * Creates and configures a Winston logger instance with enhanced security and monitoring capabilities
 * @param config Logger configuration options
 * @returns Configured Winston logger instance
 */
export const createLogger = (config: LoggerConfig = defaultLoggerConfig): winston.Logger => {
  // Configure ECS format for ELK Stack compatibility
  const ecsFormatter = ecsFormat({ apmIntegration: true });
  
  const transports: winston.transport[] = [];

  // Configure console transport with colors
  if (config.console) {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }));
  }

  // Configure file transport with rotation
  if (config.file) {
    transports.push(new DailyRotateFile({
      filename: config.filename,
      datePattern: 'YYYY-MM-DD',
      maxSize: config.maxSize,
      maxFiles: config.maxFiles,
      compress: config.compress,
      format: winston.format.combine(
        ecsFormatter,
        winston.format.timestamp(),
        winston.format.json()
      )
    }));
  }

  // Create the logger instance
  const logger = winston.createLogger({
    level: config.level,
    levels: LOG_LEVELS,
    transports,
    exitOnError: false,
  });

  // Add error handling for transports
  transports.forEach(transport => {
    transport.on('error', (error) => {
      console.error('Logging transport error:', error);
    });
  });

  return logger;
};

// Create the default logger instance
const defaultLogger = createLogger();

/**
 * Enhanced error logging with security context and stack traces
 * @param message Error message
 * @param error Error object
 * @param context Log context
 */
export const error = (message: string, error: Error, context: LogContext): void => {
  if (defaultLoggerConfig.sanitizeLogs) {
    message = sanitizeLogMessage(message);
  }

  defaultLogger.error({
    message,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      severity: 'ERROR',
    }
  });
};

/**
 * Enhanced info logging with context validation and sampling
 * @param message Info message
 * @param context Log context
 */
export const info = (message: string, context: LogContext): void => {
  // Apply sampling if configured
  if (Math.random() > defaultLoggerConfig.sampleRate) {
    return;
  }

  if (defaultLoggerConfig.sanitizeLogs) {
    message = sanitizeLogMessage(message);
  }

  defaultLogger.info({
    message,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      severity: 'INFO',
    }
  });
};

/**
 * Enhanced warning logging with context
 * @param message Warning message
 * @param context Log context
 */
export const warn = (message: string, context: LogContext): void => {
  if (defaultLoggerConfig.sanitizeLogs) {
    message = sanitizeLogMessage(message);
  }

  defaultLogger.warn({
    message,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      severity: 'WARN',
    }
  });
};

/**
 * Enhanced debug logging with context
 * @param message Debug message
 * @param context Log context
 */
export const debug = (message: string, context: LogContext): void => {
  if (defaultLoggerConfig.sanitizeLogs) {
    message = sanitizeLogMessage(message);
  }

  defaultLogger.debug({
    message,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      severity: 'DEBUG',
    }
  });
};

// Export the logger instance with enhanced methods
export const logger = {
  createLogger,
  error,
  warn,
  info,
  debug,
};

export default logger;