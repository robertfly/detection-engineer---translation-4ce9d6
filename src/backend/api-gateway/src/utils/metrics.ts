// External dependencies
import * as promClient from 'prom-client'; // v14.2.0

// Internal dependencies
import { error, debug } from './logger';

// Interfaces for metric configuration
export interface MetricLabels {
  service: string;
  endpoint: string;
  method: string;
  status: string;
  error_type: string;
  security_event: string;
  rate_limit_group: string;
}

export interface ServiceMetric {
  name: string;
  help: string;
  type: string;
  labels: MetricLabels;
  buckets?: number[];
  slo_targets?: {
    [key: string]: number;
  };
}

// Constants
const DEFAULT_METRICS_PREFIX = 'api_gateway_';
const METRIC_TYPES = {
  counter: 'Counter',
  gauge: 'Gauge',
  histogram: 'Histogram',
  summary: 'Summary',
} as const;

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// Default metric definitions
const defaultMetrics = {
  http_requests_total: {
    type: METRIC_TYPES.counter,
    help: 'Total HTTP requests processed with security context',
  },
  http_request_duration_seconds: {
    type: METRIC_TYPES.histogram,
    help: 'HTTP request duration in seconds with detailed buckets',
  },
  rate_limit_events_total: {
    type: METRIC_TYPES.counter,
    help: 'Total rate limiting events by group',
  },
  security_events_total: {
    type: METRIC_TYPES.counter,
    help: 'Total security events by type',
  },
  service_calls_total: {
    type: METRIC_TYPES.counter,
    help: 'Total service-to-service calls with performance tracking',
  },
  service_call_duration_seconds: {
    type: METRIC_TYPES.histogram,
    help: 'Service call duration in seconds with SLO tracking',
  },
  service_health_score: {
    type: METRIC_TYPES.gauge,
    help: 'Service health score by component',
  },
};

// Metric registry and collectors
let registry: promClient.Registry;
const collectors: Map<string, promClient.Counter | promClient.Histogram | promClient.Gauge> = new Map();

/**
 * Initializes enhanced Prometheus metrics registry with security and performance metrics
 */
export const initializeMetrics = (): void => {
  try {
    // Create new registry with default settings
    registry = new promClient.Registry();

    // Enable default metrics collection
    promClient.collectDefaultMetrics({
      prefix: DEFAULT_METRICS_PREFIX,
      register: registry,
      labels: { service: 'api_gateway' },
    });

    // Initialize service metrics
    Object.entries(defaultMetrics).forEach(([name, config]) => {
      const metricName = `${DEFAULT_METRICS_PREFIX}${name}`;
      
      switch (config.type) {
        case METRIC_TYPES.counter:
          collectors.set(name, new promClient.Counter({
            name: metricName,
            help: config.help,
            labelNames: Object.keys(MetricLabels),
            registers: [registry],
          }));
          break;

        case METRIC_TYPES.histogram:
          collectors.set(name, new promClient.Histogram({
            name: metricName,
            help: config.help,
            labelNames: Object.keys(MetricLabels),
            buckets: HISTOGRAM_BUCKETS,
            registers: [registry],
          }));
          break;

        case METRIC_TYPES.gauge:
          collectors.set(name, new promClient.Gauge({
            name: metricName,
            help: config.help,
            labelNames: Object.keys(MetricLabels),
            registers: [registry],
          }));
          break;
      }
    });

    debug('Metrics initialization completed successfully', {
      requestId: 'metrics_init',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'init',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    error('Failed to initialize metrics', err as Error, {
      requestId: 'metrics_init_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'init',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
  }
};

/**
 * Records enhanced HTTP request metrics including security and performance data
 */
export const recordRequestMetric = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  securityContext: {
    errorType?: string;
    securityEvent?: string;
    rateLimitGroup?: string;
  } = {}
): void => {
  try {
    const labels: Partial<MetricLabels> = {
      service: 'api_gateway',
      endpoint: path,
      method: method.toUpperCase(),
      status: String(statusCode),
      error_type: securityContext.errorType || 'none',
      security_event: securityContext.securityEvent || 'none',
      rate_limit_group: securityContext.rateLimitGroup || 'none',
    };

    // Record request count
    const requestCounter = collectors.get('http_requests_total') as promClient.Counter;
    requestCounter.inc(labels);

    // Record request duration
    const durationHistogram = collectors.get('http_request_duration_seconds') as promClient.Histogram;
    durationHistogram.observe(labels, duration);

    // Record security events if applicable
    if (securityContext.securityEvent) {
      const securityCounter = collectors.get('security_events_total') as promClient.Counter;
      securityCounter.inc(labels);
    }

    // Record rate limiting events if applicable
    if (securityContext.rateLimitGroup) {
      const rateLimitCounter = collectors.get('rate_limit_events_total') as promClient.Counter;
      rateLimitCounter.inc(labels);
    }
  } catch (err) {
    error('Failed to record request metric', err as Error, {
      requestId: 'metric_record_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'record_request',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
  }
};

/**
 * Records enhanced service-to-service communication metrics with performance tracking
 */
export const recordServiceMetric = (
  service: string,
  operation: string,
  status: string,
  duration: number,
  performanceContext: {
    healthScore?: number;
    sloTarget?: number;
  } = {}
): void => {
  try {
    const labels: Partial<MetricLabels> = {
      service,
      endpoint: operation,
      method: 'SERVICE_CALL',
      status,
      error_type: 'none',
      security_event: 'none',
      rate_limit_group: 'none',
    };

    // Record service call count
    const serviceCounter = collectors.get('service_calls_total') as promClient.Counter;
    serviceCounter.inc(labels);

    // Record service call duration
    const serviceDurationHistogram = collectors.get('service_call_duration_seconds') as promClient.Histogram;
    serviceDurationHistogram.observe(labels, duration);

    // Update service health score if provided
    if (typeof performanceContext.healthScore === 'number') {
      const healthGauge = collectors.get('service_health_score') as promClient.Gauge;
      healthGauge.set(labels, performanceContext.healthScore);
    }
  } catch (err) {
    error('Failed to record service metric', err as Error, {
      requestId: 'metric_service_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'record_service',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
  }
};

/**
 * Retrieves enhanced metrics in Prometheus format with security and performance data
 */
export const getMetrics = async (): Promise<string> => {
  try {
    return await registry.metrics();
  } catch (err) {
    error('Failed to retrieve metrics', err as Error, {
      requestId: 'metric_retrieve_error',
      service: 'api_gateway',
      traceId: 'system',
      spanId: 'get_metrics',
      environment: process.env.NODE_ENV || 'development',
      userId: 'system',
    });
    return '';
  }
};

// Initialize metrics on module load
initializeMetrics();

// Export metrics utility
export const metrics = {
  recordRequestMetric,
  recordServiceMetric,
  getMetrics,
};

export default metrics;