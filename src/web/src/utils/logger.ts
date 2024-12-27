// debug version: ^4.3.4
import debug from 'debug';
import { APP_CONFIG } from '../config/constants';

/**
 * Configuration interface for logger settings with environment awareness
 */
interface LoggerConfig {
  level: string;
  enableConsole: boolean;
  enableDebug: boolean;
  environment: string;
  enablePiiProtection: boolean;
  sampleRate: number;
  bufferSize: number;
}

/**
 * Enhanced interface for log entry context with security and tracking metadata
 */
interface LogContext {
  timestamp: string;
  level: string;
  appName: string;
  version: string;
  correlationId: string;
  sessionId: string;
  metadata: Record<string, any>;
  userId: string;
  userRole: string;
}

/**
 * Available log levels with severity ordering
 */
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof LOG_LEVELS[number];

/**
 * Enhanced default logger configuration with security and performance settings
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableDebug: process.env.NODE_ENV !== 'production',
  environment: process.env.NODE_ENV || 'development',
  enablePiiProtection: process.env.NODE_ENV === 'production',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  bufferSize: process.env.NODE_ENV === 'production' ? 100 : 1,
};

/**
 * PII patterns for sensitive data protection
 */
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, // SSN
];

class Logger {
  private config: LoggerConfig;
  private buffer: any[] = [];
  private debugInstance: debug.Debugger;
  private correlationId: string = '';

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debugInstance = debug(APP_CONFIG.APP_NAME);
    this.initializeLogger();
  }

  /**
   * Initialize logger with configuration settings
   */
  private initializeLogger(): void {
    if (this.config.enableDebug) {
      this.debugInstance.enabled = true;
    }

    if (!this.config.enableConsole) {
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
      console.error = () => {};
    }
  }

  /**
   * Create base context for log entries
   */
  private createContext(level: LogLevel, metadata: Record<string, any> = {}): LogContext {
    return {
      timestamp: new Date().toISOString(),
      level,
      appName: APP_CONFIG.APP_NAME,
      version: APP_CONFIG.APP_VERSION,
      correlationId: this.correlationId || crypto.randomUUID(),
      sessionId: sessionStorage.getItem('sessionId') || '',
      metadata,
      userId: sessionStorage.getItem('userId') || '',
      userRole: sessionStorage.getItem('userRole') || '',
    };
  }

  /**
   * Sanitize sensitive information from log data
   */
  private sanitizePii(data: any): any {
    if (!this.config.enablePiiProtection) return data;

    const sanitize = (str: string): string => {
      let sanitized = str;
      PII_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
      return sanitized;
    };

    if (typeof data === 'string') {
      return sanitize(data);
    } else if (typeof data === 'object' && data !== null) {
      return Object.entries(data).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: typeof value === 'string' ? sanitize(value) : value,
      }), {});
    }

    return data;
  }

  /**
   * Check if log should be sampled based on configuration
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Process and format log entry
   */
  private processLog(level: LogLevel, message: string, metadata: Record<string, any> = {}): void {
    if (!this.shouldSample()) return;

    const context = this.createContext(level, metadata);
    const sanitizedMessage = this.sanitizePii(message);
    const sanitizedMetadata = this.sanitizePii(metadata);

    const logEntry = {
      ...context,
      message: sanitizedMessage,
      metadata: sanitizedMetadata,
    };

    if (this.config.bufferSize > 1) {
      this.buffer.push(logEntry);
      if (this.buffer.length >= this.config.bufferSize) {
        this.flush();
      }
    } else {
      this.outputLog(logEntry);
    }
  }

  /**
   * Output log entry to configured destinations
   */
  private outputLog(logEntry: any): void {
    const { level, message, metadata } = logEntry;

    if (this.config.enableConsole) {
      switch (level) {
        case 'debug':
          this.debugInstance(message, metadata);
          break;
        case 'info':
          console.info(message, metadata);
          break;
        case 'warn':
          console.warn(message, metadata);
          break;
        case 'error':
          console.error(message, metadata);
          break;
      }
    }

    // Additional log shipping to monitoring systems could be added here
  }

  /**
   * Set correlation ID for request tracking
   */
  public setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Flush buffered logs
   */
  public flush(): void {
    if (this.buffer.length === 0) return;

    this.buffer.forEach(logEntry => this.outputLog(logEntry));
    this.buffer = [];
  }

  /**
   * Log methods for different severity levels
   */
  public debug(message: string, metadata: Record<string, any> = {}): void {
    if (LOG_LEVELS.indexOf(this.config.level as LogLevel) <= LOG_LEVELS.indexOf('debug')) {
      this.processLog('debug', message, metadata);
    }
  }

  public info(message: string, metadata: Record<string, any> = {}): void {
    if (LOG_LEVELS.indexOf(this.config.level as LogLevel) <= LOG_LEVELS.indexOf('info')) {
      this.processLog('info', message, metadata);
    }
  }

  public warn(message: string, metadata: Record<string, any> = {}): void {
    if (LOG_LEVELS.indexOf(this.config.level as LogLevel) <= LOG_LEVELS.indexOf('warn')) {
      this.processLog('warn', message, metadata);
    }
  }

  public error(message: string, metadata: Record<string, any> = {}): void {
    if (LOG_LEVELS.indexOf(this.config.level as LogLevel) <= LOG_LEVELS.indexOf('error')) {
      this.processLog('error', message, metadata);
    }
  }
}

/**
 * Export configured logger instance with all logging methods and buffer management
 */
export const logger = new Logger();
export type { LoggerConfig, LogContext };