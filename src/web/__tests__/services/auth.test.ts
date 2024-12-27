// @jest/globals version: ^29.0.0
// @auth0/auth0-spa-js version: ^2.1.0
import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { Auth0Client } from '@auth0/auth0-spa-js';
import { AuthService, initializeAuth, login, logout, getUser, getToken, handleMFAChallenge, refreshToken } from '../../src/services/auth';
import { auth0Config, authOptions } from '../../src/config/auth';
import { StorageType, SecureStorage } from '../../src/utils/storage';

// Mock Auth0 client
jest.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    loginWithRedirect: jest.fn(),
    logout: jest.fn(),
    getUser: jest.fn(),
    getTokenSilently: jest.fn(),
    handleRedirectCallback: jest.fn()
  }))
}));

// Mock secure storage
jest.mock('../../src/utils/storage', () => ({
  StorageType: {
    LOCAL: 'localStorage',
    SESSION: 'sessionStorage'
  },
  SecureStorage: {
    encryptData: jest.fn()
  }
}));

// Test constants
const TEST_USER = {
  sub: 'auth0|123456789',
  email: 'test@example.com',
  name: 'Test User',
  'https://detection-translator/roles': ['ANALYST'],
  'https://detection-translator/permissions': ['TRANSLATE'],
  updated_at: '2023-01-01T00:00:00.000Z'
};

const TEST_TOKEN = {
  accessToken: 'test-access-token',
  tokenType: 'Bearer',
  expiresAt: Date.now() + 3600000,
  issuedAt: Date.now(),
  refreshToken: 'test-refresh-token'
};

describe('Auth Service', () => {
  let mockAuth0Client: jest.Mocked<Auth0Client>;
  let originalWindow: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock window.crypto
    originalWindow = global.window;
    global.window = {
      ...originalWindow,
      crypto: {
        randomUUID: jest.fn().mockReturnValue('test-uuid')
      }
    };

    // Mock localStorage and sessionStorage
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn()
    };

    global.sessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn()
    };

    // Initialize mock Auth0 client
    mockAuth0Client = new Auth0Client({}) as jest.Mocked<Auth0Client>;
  });

  afterEach(() => {
    global.window = originalWindow;
    jest.resetModules();
  });

  test('initializeAuth should properly configure Auth0 client with security settings', async () => {
    const authService = new AuthService();
    
    await authService.initializeAuth();

    expect(Auth0Client).toHaveBeenCalledWith({
      domain: auth0Config.domain,
      client_id: auth0Config.clientId,
      audience: auth0Config.audience,
      scope: 'openid profile email',
      cacheLocation: 'memory',
      useRefreshTokens: true,
      advancedOptions: {
        defaultScope: auth0Config.scope
      }
    });
  });

  test('login should handle MFA configuration and rate limiting', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    await authService.login();

    expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith({
      acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
      max_age: 3600
    });
  });

  test('handleMFAChallenge should process MFA verification correctly', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    mockAuth0Client.getTokenSilently.mockResolvedValueOnce('mfa-token');

    const result = await authService.handleMFAChallenge();

    expect(mockAuth0Client.getTokenSilently).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  test('getToken should handle secure token retrieval and encryption', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    // Mock secure storage retrieval
    (global.localStorage.getItem as jest.Mock).mockReturnValueOnce(
      JSON.stringify({
        data: TEST_TOKEN,
        metadata: {
          encrypted: true,
          expiresAt: Date.now() + 3600000
        }
      })
    );

    const token = await authService.getToken();

    expect(token).toBeTruthy();
    expect(token?.accessToken).toBe(TEST_TOKEN.accessToken);
  });

  test('refreshToken should handle token rotation securely', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    mockAuth0Client.getTokenSilently.mockResolvedValueOnce('new-access-token');

    await authService.refreshToken();

    expect(mockAuth0Client.getTokenSilently).toHaveBeenCalledWith({
      timeoutInSeconds: 60
    });
  });

  test('logout should properly clean up session and storage', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    await authService.logout();

    expect(mockAuth0Client.logout).toHaveBeenCalledWith({
      returnTo: window.location.origin
    });
    expect(global.localStorage.removeItem).toHaveBeenCalled();
  });

  test('getUser should return properly formatted user object with security roles', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    mockAuth0Client.getUser.mockResolvedValueOnce(TEST_USER);

    const user = await authService.getUser();

    expect(user).toEqual({
      id: TEST_USER.sub,
      email: TEST_USER.email,
      name: TEST_USER.name,
      roles: TEST_USER['https://detection-translator/roles'],
      permissions: TEST_USER['https://detection-translator/permissions'],
      mfaEnabled: auth0Config.mfaConfig.enabled,
      lastLogin: new Date(TEST_USER.updated_at)
    });
  });

  test('should handle rate limiting for authentication attempts', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    // Simulate multiple rapid login attempts
    const attempts = Array(4).fill(null);
    const loginPromises = attempts.map(() => authService.login());

    await expect(Promise.all(loginPromises)).rejects.toThrow(
      'Too many authentication attempts'
    );
  });

  test('should handle token encryption and secure storage', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    mockAuth0Client.getTokenSilently.mockResolvedValueOnce('secure-token');
    mockAuth0Client.handleRedirectCallback.mockResolvedValueOnce({
      refresh_token: 'refresh-token'
    });

    await authService.handleCallback();

    expect(global.localStorage.setItem).toHaveBeenCalled();
    expect(SecureStorage.encryptData).toHaveBeenCalled();
  });

  test('should validate session timeout and token expiry', async () => {
    const authService = new AuthService();
    await authService.initializeAuth();

    // Mock expired token
    (global.localStorage.getItem as jest.Mock).mockReturnValueOnce(
      JSON.stringify({
        data: {
          ...TEST_TOKEN,
          expiresAt: Date.now() - 1000
        },
        metadata: {
          encrypted: true,
          expiresAt: Date.now() - 1000
        }
      })
    );

    const token = await authService.getToken();
    expect(token).toBeNull();
  });
});