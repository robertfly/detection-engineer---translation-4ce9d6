// jest version: ^29.7.0
// axios-mock-adapter version: ^1.22.0
// opossum version: ^7.1.0

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import CircuitBreaker from 'opossum';
import { 
  apiClient, 
  handleApiError, 
  setAuthToken, 
  signRequest, 
  encryptPayload, 
  decryptResponse 
} from '../../src/utils/api';
import { API_CONFIG } from '../../src/config/api';
import { AuthToken, TokenType } from '../../src/interfaces/auth';

// Test constants
const TEST_API_ENDPOINT = '/test-endpoint';
const TEST_REQUEST_DATA = { id: 1, data: 'test', correlationId: 'test-123' };
const TEST_RESPONSE_DATA = { success: true, data: { result: 'success' }, signature: 'valid-signature' };
const TEST_ENCRYPTION_KEY = 'test-encryption-key';
const TEST_SIGNING_KEY = 'test-signing-key';

// Mock setup
let mockAxios: MockAdapter;
let mockCircuitBreaker: CircuitBreaker;

describe('apiClient', () => {
  beforeEach(() => {
    // Initialize mock axios adapter
    mockAxios = new MockAdapter(apiClient);
    
    // Initialize mock circuit breaker
    mockCircuitBreaker = new CircuitBreaker(async () => {}, {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.reset();
    mockCircuitBreaker.shutdown();
  });

  describe('Request Handling', () => {
    it('should successfully make GET request with request signing', async () => {
      // Setup mock response
      mockAxios.onGet(TEST_API_ENDPOINT).reply(200, TEST_RESPONSE_DATA);

      // Make request with signing
      const response = await apiClient.get(TEST_API_ENDPOINT, {
        headers: { 'X-Request-Signature': await signRequest(TEST_API_ENDPOINT, TEST_SIGNING_KEY) }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(TEST_RESPONSE_DATA);
      expect(response.config.headers['X-Request-Signature']).toBeDefined();
    });

    it('should successfully make POST request with payload encryption', async () => {
      // Setup mock response
      mockAxios.onPost(TEST_API_ENDPOINT).reply(200, TEST_RESPONSE_DATA);

      // Encrypt payload and make request
      const encryptedPayload = await encryptPayload(TEST_REQUEST_DATA, TEST_ENCRYPTION_KEY);
      const response = await apiClient.post(TEST_API_ENDPOINT, encryptedPayload, {
        headers: { 'X-Payload-Encrypted': 'true' }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(TEST_RESPONSE_DATA);
    });

    it('should include correlation ID in request headers', async () => {
      mockAxios.onGet(TEST_API_ENDPOINT).reply(200);
      
      const response = await apiClient.get(TEST_API_ENDPOINT);
      
      expect(response.config.headers['X-Correlation-ID']).toBeDefined();
      expect(typeof response.config.headers['X-Correlation-ID']).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry mechanism', async () => {
      mockAxios.onGet(TEST_API_ENDPOINT).networkError();
      
      try {
        await apiClient.get(TEST_API_ENDPOINT);
      } catch (error) {
        expect(error.retryable).toBe(true);
        expect(error.recoveryOptions.canRetry).toBe(true);
      }
    });

    it('should handle rate limit errors with backoff', async () => {
      mockAxios.onPost(TEST_API_ENDPOINT).reply(429, {
        error: 'Too Many Requests'
      }, { 'Retry-After': '30' });

      try {
        await apiClient.post(TEST_API_ENDPOINT, TEST_REQUEST_DATA);
      } catch (error) {
        expect(error.statusCode).toBe(429);
        expect(error.recoveryOptions.retryAfter).toBe(30);
      }
    });

    it('should activate circuit breaker on consecutive failures', async () => {
      const failureThreshold = API_CONFIG.retry.attempts;
      
      mockAxios.onGet(TEST_API_ENDPOINT).reply(500);
      
      for (let i = 0; i <= failureThreshold; i++) {
        try {
          await apiClient.get(TEST_API_ENDPOINT);
        } catch (error) {
          continue;
        }
      }

      expect(mockCircuitBreaker.opened).toBe(true);
    });
  });

  describe('Security Features', () => {
    it('should handle authentication token refresh', async () => {
      const mockToken: AuthToken = {
        accessToken: 'test-token',
        tokenType: TokenType.Bearer,
        expiresAt: Date.now() + 300000, // 5 minutes
        issuedAt: Date.now(),
        refreshToken: 'test-refresh-token'
      };

      setAuthToken(mockToken);

      const response = await apiClient.get(TEST_API_ENDPOINT);
      expect(response.config.headers.Authorization).toBe(`Bearer ${mockToken.accessToken}`);
    });

    it('should validate response signatures', async () => {
      const signedResponse = {
        ...TEST_RESPONSE_DATA,
        signature: await signRequest(JSON.stringify(TEST_RESPONSE_DATA), TEST_SIGNING_KEY)
      };

      mockAxios.onGet(TEST_API_ENDPOINT).reply(200, signedResponse);

      const response = await apiClient.get(TEST_API_ENDPOINT);
      expect(response.data.signature).toBeDefined();
      expect(await verifySignature(response.data)).toBe(true);
    });

    it('should handle encrypted responses', async () => {
      const encryptedResponse = await encryptPayload(TEST_RESPONSE_DATA, TEST_ENCRYPTION_KEY);
      mockAxios.onGet(TEST_API_ENDPOINT).reply(200, encryptedResponse, {
        'X-Response-Encrypted': 'true'
      });

      const response = await apiClient.get(TEST_API_ENDPOINT);
      const decryptedData = await decryptResponse(response.data, TEST_ENCRYPTION_KEY);
      expect(decryptedData).toEqual(TEST_RESPONSE_DATA);
    });
  });
});

describe('handleApiError', () => {
  it('should enhance error with tracking information', () => {
    const mockError = {
      response: {
        status: 400,
        data: { message: 'Bad Request' }
      },
      message: 'Request failed'
    };

    const enhancedError = handleApiError(mockError);

    expect(enhancedError.errorId).toBeDefined();
    expect(enhancedError.errorClass).toBeDefined();
    expect(enhancedError.retryable).toBeDefined();
    expect(enhancedError.recoveryOptions).toBeDefined();
  });

  it('should classify security errors appropriately', () => {
    const mockSecurityError = {
      response: {
        status: 401,
        data: { message: 'Unauthorized' }
      },
      message: 'Authentication failed'
    };

    const enhancedError = handleApiError(mockSecurityError);

    expect(enhancedError.errorClass).toBe('SecurityError');
    expect(enhancedError.retryable).toBe(false);
    expect(enhancedError.recoveryOptions.suggestedAction).toBe('Please reauthenticate and try again');
  });
});

describe('setAuthToken', () => {
  it('should update authorization headers', () => {
    const mockToken: AuthToken = {
      accessToken: 'test-token',
      tokenType: TokenType.Bearer,
      expiresAt: Date.now() + 3600000,
      issuedAt: Date.now(),
      refreshToken: 'test-refresh-token'
    };

    setAuthToken(mockToken);

    expect(apiClient.defaults.headers.common['Authorization'])
      .toBe(`Bearer ${mockToken.accessToken}`);
  });

  it('should schedule token refresh', () => {
    jest.useFakeTimers();
    
    const mockToken: AuthToken = {
      accessToken: 'test-token',
      tokenType: TokenType.Bearer,
      expiresAt: Date.now() + 3600000,
      issuedAt: Date.now(),
      refreshToken: 'test-refresh-token'
    };

    setAuthToken(mockToken);
    
    jest.advanceTimersByTime(3300000); // 55 minutes
    
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.any(CustomEvent)
    );
  });
});

// Helper function to verify response signatures
async function verifySignature(data: any): Promise<boolean> {
  const { signature, ...payload } = data;
  const expectedSignature = await signRequest(JSON.stringify(payload), TEST_SIGNING_KEY);
  return signature === expectedSignature;
}