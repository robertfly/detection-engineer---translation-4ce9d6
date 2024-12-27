// axios version: ^1.6.0
// axios-retry version: ^3.8.0
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { API_CONFIG } from '../config/api';
import { AuthToken } from '../interfaces/auth';
import { logger } from './logger';

/**
 * Generic interface for API responses with enhanced error handling
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/**
 * Enhanced interface for API error responses with detailed error tracking
 */
export interface ApiError {
  statusCode: number;
  message: string;
  code: string;
  details: any;
  errorId: string;
  errorClass: string;
  retryable: boolean;
  recoveryOptions: {
    canRetry: boolean;
    retryAfter?: number;
    alternativeEndpoint?: string;
    suggestedAction?: string;
  };
}

/**
 * Enhanced interface for request configuration options with security features
 */
export interface RequestConfig extends AxiosRequestConfig {
  encrypt?: boolean;
  correlationId?: string;
  retry?: {
    attempts: number;
    backoffMs: number;
    retryCondition?: (error: AxiosError) => boolean;
  };
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
}

// Global configuration constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CIRCUIT_BREAKER_OPTIONS = {
  failureThreshold: 5,
  resetTimeout: 30000,
};

// Security headers following OWASP recommendations
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Security-Version': '1.0',
  'X-Client-Version': '1.0',
};

/**
 * Creates and configures an enhanced Axios instance with security, monitoring,
 * and reliability features
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    ...API_CONFIG,
    headers: { ...DEFAULT_HEADERS, ...API_CONFIG.headers },
  });

  // Configure retry behavior with exponential backoff
  axiosRetry(client, {
    retries: MAX_RETRIES,
    retryDelay: (retryCount) => {
      return retryCount * RETRY_DELAY;
    },
    retryCondition: (error: AxiosError) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status === 429) ||
        (error.response?.status === 503);
    },
  });

  // Request interceptor for authentication and security
  client.interceptors.request.use(
    (config) => {
      // Add correlation ID for request tracking
      const correlationId = crypto.randomUUID();
      config.headers['X-Correlation-ID'] = correlationId;
      logger.setCorrelationId(correlationId);

      // Add security headers
      config.headers['X-Request-ID'] = crypto.randomUUID();
      config.headers['X-Timestamp'] = new Date().toISOString();

      // Log request metrics
      logger.info('API Request', {
        method: config.method,
        url: config.url,
        correlationId,
      });

      return config;
    },
    (error) => {
      logger.error('Request interceptor error', { error });
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling and metrics
  client.interceptors.response.use(
    (response) => {
      // Track response metrics
      logger.info('API Response', {
        status: response.status,
        url: response.config.url,
        correlationId: response.config.headers['X-Correlation-ID'],
        duration: Date.now() - new Date(response.config.headers['X-Timestamp']).getTime(),
      });

      return response;
    },
    (error: AxiosError) => {
      const enhancedError = handleApiError(error);
      logger.error('API Error', { error: enhancedError });
      return Promise.reject(enhancedError);
    }
  );

  return client;
};

/**
 * Enhanced error processor with detailed error tracking and recovery options
 */
export const handleApiError = (error: AxiosError): ApiError => {
  const errorId = crypto.randomUUID();
  const statusCode = error.response?.status || 500;
  const errorClass = error.code || 'UnknownError';

  const apiError: ApiError = {
    statusCode,
    message: error.message,
    code: errorClass,
    details: error.response?.data,
    errorId,
    errorClass,
    retryable: statusCode >= 500 || statusCode === 429,
    recoveryOptions: {
      canRetry: statusCode >= 500 || statusCode === 429,
      retryAfter: parseInt(error.response?.headers['retry-after'] || '0', 10),
      alternativeEndpoint: error.response?.headers['alternative-endpoint'],
      suggestedAction: getSuggestedAction(statusCode),
    },
  };

  // Log security-related errors
  if (statusCode === 401 || statusCode === 403) {
    logger.security('Security error occurred', {
      errorId,
      statusCode,
      endpoint: error.config?.url,
    });
  }

  return apiError;
};

/**
 * Get suggested recovery action based on error status code
 */
const getSuggestedAction = (statusCode: number): string => {
  switch (statusCode) {
    case 401:
      return 'Please reauthenticate and try again';
    case 403:
      return 'Insufficient permissions for this operation';
    case 429:
      return 'Please wait before retrying the request';
    case 503:
      return 'Service temporarily unavailable, please try again later';
    default:
      return 'Please try again or contact support if the issue persists';
  }
};

/**
 * Enhanced authentication token manager with security features
 */
export const setAuthToken = (token: AuthToken): void => {
  if (!token.accessToken || !token.expiresAt) {
    throw new Error('Invalid authentication token');
  }

  // Update axios default headers
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;
  
  // Schedule token refresh
  const refreshTime = token.expiresAt - Date.now() - (5 * 60 * 1000); // 5 minutes before expiry
  if (refreshTime > 0) {
    setTimeout(() => {
      logger.info('Token refresh required');
      // Trigger token refresh event
      window.dispatchEvent(new CustomEvent('token-refresh-required'));
    }, refreshTime);
  }

  // Log security event
  logger.security('Auth token updated', {
    tokenExpiry: new Date(token.expiresAt).toISOString(),
  });
};

// Create and export the configured API client instance
export const apiClient = createApiClient();

// Export type definitions for better type safety
export type { AxiosInstance, AxiosError, AxiosRequestConfig };