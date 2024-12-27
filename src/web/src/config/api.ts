// axios version: ^1.6.0
import axios, { AxiosRequestConfig } from 'axios';
import { AuthConfig } from '../interfaces/auth';
import { APP_CONFIG } from './constants';
import { logger } from '../utils/logger';

/**
 * Enhanced interface for API configuration settings with security and monitoring
 */
export interface ApiConfig extends AxiosRequestConfig {
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
    remaining: number;
  };
  retry: {
    attempts: number;
    backoffMs: number;
    statusCodes: number[];
  };
  security: {
    headers: Record<string, string>;
    encryption: {
      enabled: boolean;
      algorithm: string;
    };
    requestSigning: {
      enabled: boolean;
      algorithm: string;
    };
  };
  monitoring: {
    enabled: boolean;
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    errorTracking: boolean;
  };
}

/**
 * Enhanced interface defining API endpoint paths with health checks
 */
export interface ApiEndpoints {
  detection: {
    create: string;
    update: string;
    delete: string;
    get: string;
    list: string;
  };
  translation: {
    single: string;
    batch: string;
    status: string;
    cancel: string;
  };
  github: {
    connect: string;
    sync: string;
    status: string;
    list: string;
  };
  validation: {
    check: string;
    rules: string;
    report: string;
  };
  health: {
    status: string;
    metrics: string;
    readiness: string;
    liveness: string;
  };
  rateLimit: {
    status: string;
    reset: string;
  };
}

// API version and base configuration constants
const API_VERSION = 'v1';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RATE_LIMIT_THRESHOLD = 100;

// Security headers following OWASP recommendations
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// Global request tracking headers
const CORRELATION_HEADER = 'X-Correlation-ID';
const RATE_LIMIT_HEADER = 'X-RateLimit-Remaining';

// API base URL from environment variables
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Creates enhanced API configuration with security, monitoring, and rate limiting
 * @param authConfig - Authentication configuration
 * @returns Enhanced API configuration settings
 */
const createApiConfig = (authConfig: AuthConfig): ApiConfig => {
  const config: ApiConfig = {
    baseURL: `${API_BASE_URL}/${API_VERSION}`,
    timeout: DEFAULT_TIMEOUT,
    withCredentials: true,
    headers: {
      ...SECURITY_HEADERS,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Version': APP_CONFIG.APP_VERSION,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: RATE_LIMIT_THRESHOLD,
      burstLimit: RATE_LIMIT_THRESHOLD * 1.2,
      remaining: RATE_LIMIT_THRESHOLD,
    },
    retry: {
      attempts: MAX_RETRIES,
      backoffMs: 1000,
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    security: {
      headers: SECURITY_HEADERS,
      encryption: {
        enabled: true,
        algorithm: 'AES-256-GCM',
      },
      requestSigning: {
        enabled: true,
        algorithm: 'SHA-256',
      },
    },
    monitoring: {
      enabled: true,
      metricsEnabled: true,
      tracingEnabled: true,
      errorTracking: true,
    },
  };

  return config;
};

/**
 * Enhanced API configuration with security and monitoring
 */
export const API_CONFIG: Readonly<ApiConfig> = createApiConfig({
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
});

/**
 * Enhanced API endpoints with health checks and monitoring
 */
export const API_ENDPOINTS: Readonly<ApiEndpoints> = {
  detection: {
    create: '/detections',
    update: '/detections/:id',
    delete: '/detections/:id',
    get: '/detections/:id',
    list: '/detections',
  },
  translation: {
    single: '/translate',
    batch: '/translate/batch',
    status: '/translate/status/:id',
    cancel: '/translate/cancel/:id',
  },
  github: {
    connect: '/github/connect',
    sync: '/github/sync',
    status: '/github/status',
    list: '/github/repositories',
  },
  validation: {
    check: '/validate',
    rules: '/validate/rules',
    report: '/validate/report/:id',
  },
  health: {
    status: '/health',
    metrics: '/health/metrics',
    readiness: '/health/ready',
    liveness: '/health/live',
  },
  rateLimit: {
    status: '/rate-limit/status',
    reset: '/rate-limit/reset',
  },
};

// Configure axios interceptors for enhanced functionality
axios.interceptors.request.use(
  (config) => {
    // Add correlation ID for request tracking
    config.headers[CORRELATION_HEADER] = crypto.randomUUID();
    return config;
  },
  (error) => {
    logger.error('Request interceptor error', { error });
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    // Track rate limit headers
    const remaining = response.headers[RATE_LIMIT_HEADER];
    if (remaining) {
      API_CONFIG.rateLimit.remaining = parseInt(remaining, 10);
    }
    return response;
  },
  (error) => {
    logger.error('Response interceptor error', { error });
    return Promise.reject(error);
  }
);

export default {
  API_CONFIG,
  API_ENDPOINTS,
};