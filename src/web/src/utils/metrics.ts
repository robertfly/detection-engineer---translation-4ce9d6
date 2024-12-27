// @datadog/browser-rum version: ^4.47.0
// web-vitals version: ^3.5.0
import { datadogRum } from '@datadog/browser-rum';
import * as WebVitals from 'web-vitals';
import { APP_NAME, APP_VERSION } from '../config/constants';
import { logger } from './logger';

/**
 * Enhanced configuration interface for metrics settings with security and compliance options
 */
export interface MetricsConfig {
  environment: string;
  datadogClientToken: string;
  datadogApplicationId: string;
  enableRUM: boolean;
  enableWebVitals: boolean;
  sampleRate: number;
  securityMode: SecurityMode;
  customTags: Record<string, string>;
  enablePIIProtection: boolean;
  bufferConfig: MetricBufferConfig;
}

/**
 * Security configuration for metrics collection
 */
export interface SecurityMode {
  enableAuditTrail: boolean;
  encryptSensitiveData: boolean;
  sensitiveFields: string[];
  retentionDays: number;
}

/**
 * Configuration for metric batching and buffering
 */
export interface MetricBufferConfig {
  maxSize: number;
  flushInterval: number;
  enableCompression: boolean;
}

/**
 * Security monitoring thresholds
 */
const SECURITY_THRESHOLDS = {
  maxFailedAuth: 5,
  rateLimit: 100,
  suspiciousPatternThreshold: 0.8,
  securityAlertTimeout: 300000, // 5 minutes
} as const;

/**
 * Enhanced metric categories with security focus
 */
const METRIC_CATEGORIES = [
  'performance',
  'security_auth',
  'security_access',
  'security_patterns',
  'user_activity',
  'translation',
  'validation',
  'github',
  'compliance',
] as const;

/**
 * Security context for metric tracking
 */
interface SecurityContext {
  userId: string;
  sessionId: string;
  userRole: string;
  ipAddress: string;
  timestamp: number;
}

/**
 * Security metric event interface
 */
interface SecurityMetricEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  source: string;
}

/**
 * Metric buffer for batching and processing
 */
class MetricBuffer {
  private buffer: any[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private config: MetricBufferConfig) {
    this.initializeBuffer();
  }

  private initializeBuffer(): void {
    if (this.config.flushInterval > 0) {
      this.timer = setInterval(() => this.flush(), this.config.flushInterval);
    }
  }

  public add(metric: any): void {
    this.buffer.push(metric);
    if (this.buffer.length >= this.config.maxSize) {
      this.flush();
    }
  }

  public flush(): void {
    if (this.buffer.length === 0) return;

    const metrics = this.config.enableCompression 
      ? this.compressMetrics(this.buffer)
      : this.buffer;

    datadogRum.addAction('metrics_batch', { metrics });
    this.buffer = [];
  }

  private compressMetrics(metrics: any[]): any[] {
    // Implement metric compression logic here
    return metrics.map(m => ({
      ...m,
      compressed: true,
      timestamp: m.timestamp || Date.now()
    }));
  }

  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

/**
 * Security audit trail manager
 */
class SecurityAuditTrail {
  private events: SecurityMetricEvent[] = [];

  public addEvent(event: SecurityMetricEvent, context: SecurityContext): void {
    this.events.push({
      ...event,
      timestamp: context.timestamp,
      userId: context.userId,
      sessionId: context.sessionId
    });

    if (event.severity === 'high' || event.severity === 'critical') {
      this.triggerSecurityAlert(event, context);
    }
  }

  private triggerSecurityAlert(event: SecurityMetricEvent, context: SecurityContext): void {
    datadogRum.addAction('security_alert', {
      event,
      context,
      timestamp: Date.now()
    });
  }
}

let metricBuffer: MetricBuffer | null = null;
let securityAuditTrail: SecurityAuditTrail | null = null;

/**
 * Initialize enhanced metrics collection with security and performance optimizations
 */
export const initializeMetrics = (config: MetricsConfig): void => {
  try {
    // Initialize Datadog RUM
    datadogRum.init({
      applicationId: config.datadogApplicationId,
      clientToken: config.datadogClientToken,
      site: 'datadoghq.com',
      service: APP_NAME,
      env: config.environment,
      version: APP_VERSION,
      sampleRate: config.sampleRate,
      trackInteractions: true,
      defaultPrivacyLevel: config.enablePIIProtection ? 'mask' : 'allow'
    });

    // Initialize metric buffer
    metricBuffer = new MetricBuffer(config.bufferConfig);

    // Initialize security audit trail if enabled
    if (config.securityMode.enableAuditTrail) {
      securityAuditTrail = new SecurityAuditTrail();
    }

    // Initialize Web Vitals tracking if enabled
    if (config.enableWebVitals) {
      WebVitals.onCLS(metric => trackWebVital('CLS', metric));
      WebVitals.onFID(metric => trackWebVital('FID', metric));
      WebVitals.onLCP(metric => trackWebVital('LCP', metric));
      WebVitals.onTTFB(metric => trackWebVital('TTFB', metric));
      WebVitals.onFCP(metric => trackWebVital('FCP', metric));
    }

    logger.info('Metrics initialized successfully', { config: { ...config, datadogClientToken: '[REDACTED]' } });
  } catch (error) {
    logger.error('Failed to initialize metrics', { error });
  }
};

/**
 * Track Web Vitals metrics
 */
const trackWebVital = (name: string, metric: any): void => {
  if (!metricBuffer) return;

  metricBuffer.add({
    type: 'web_vital',
    name,
    value: metric.value,
    rating: metric.rating,
    timestamp: Date.now()
  });
};

/**
 * Track user activity patterns with security analysis
 */
export const trackUserActivity = (
  activityType: string,
  activityData: Record<string, any>,
  securityContext: SecurityContext
): void => {
  if (!metricBuffer) return;

  // Sanitize sensitive data
  const sanitizedData = sanitizeMetricData(activityData);

  // Track activity metric
  metricBuffer.add({
    type: 'user_activity',
    activityType,
    data: sanitizedData,
    context: securityContext,
    timestamp: Date.now()
  });

  // Analyze for suspicious patterns
  analyzeSecurity(activityType, sanitizedData, securityContext);
};

/**
 * Track security-specific metrics with enhanced monitoring
 */
export const trackSecurityMetric = (
  event: SecurityMetricEvent,
  context: SecurityContext
): void => {
  if (!metricBuffer || !securityAuditTrail) return;

  // Add to security audit trail
  securityAuditTrail.addEvent(event, context);

  // Track security metric
  metricBuffer.add({
    type: 'security_metric',
    event,
    context,
    timestamp: Date.now()
  });

  // Check security thresholds
  checkSecurityThresholds(event, context);
};

/**
 * Sanitize sensitive data from metrics
 */
const sanitizeMetricData = (data: Record<string, any>): Record<string, any> => {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /credential/i
  ];

  return Object.entries(data).reduce((acc, [key, value]) => {
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
    return {
      ...acc,
      [key]: isSensitive ? '[REDACTED]' : value
    };
  }, {});
};

/**
 * Analyze security patterns in user activity
 */
const analyzeSecurity = (
  activityType: string,
  data: Record<string, any>,
  context: SecurityContext
): void => {
  // Implement security pattern analysis
  const suspiciousScore = calculateSuspiciousScore(activityType, data, context);

  if (suspiciousScore >= SECURITY_THRESHOLDS.suspiciousPatternThreshold) {
    trackSecurityMetric(
      {
        type: 'suspicious_activity',
        severity: 'high',
        details: { activityType, suspiciousScore },
        source: 'activity_analysis'
      },
      context
    );
  }
};

/**
 * Calculate suspicious activity score
 */
const calculateSuspiciousScore = (
  activityType: string,
  data: Record<string, any>,
  context: SecurityContext
): number => {
  // Implement suspicious activity scoring logic
  return 0.0; // Placeholder implementation
};

/**
 * Check security thresholds and trigger alerts
 */
const checkSecurityThresholds = (
  event: SecurityMetricEvent,
  context: SecurityContext
): void => {
  if (event.type === 'failed_auth' && event.details.count >= SECURITY_THRESHOLDS.maxFailedAuth) {
    trackSecurityMetric(
      {
        type: 'threshold_exceeded',
        severity: 'critical',
        details: { threshold: 'maxFailedAuth', value: event.details.count },
        source: 'security_monitor'
      },
      context
    );
  }
};

// Export metrics utility
export const metrics = {
  initializeMetrics,
  trackUserActivity,
  trackSecurityMetric
};