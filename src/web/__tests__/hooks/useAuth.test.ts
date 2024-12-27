// @testing-library/react-hooks version: ^8.0.1
// @jest/globals version: ^29.7.0
// react-redux version: ^8.1.0
// @reduxjs/toolkit version: ^1.9.5

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { useAuth } from '../../src/hooks/useAuth';
import { AuthService } from '../../src/services/auth';
import { authActions } from '../../src/store/authSlice';
import { AuthUser, SecurityContext } from '../../src/interfaces/auth';

// Mock dependencies
jest.mock('../../src/services/auth');
jest.mock('../../src/utils/logger');

// Test constants
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_CHECK_INTERVAL = 60 * 1000; // 1 minute

// Mock user data
const mockUser: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['ANALYST'],
  permissions: ['READ', 'TRANSLATE'],
  mfaEnabled: true,
  lastLogin: new Date()
};

// Mock security context
const mockSecurityContext: SecurityContext = {
  lastTokenRefresh: Date.now(),
  tokenExpiresAt: Date.now() + 3600000,
  mfaVerified: true,
  sessionId: 'test-session-id'
};

/**
 * Setup test environment with mocked store and security context
 */
const setupTest = () => {
  // Create mock store with security middleware
  const store = configureStore({
    reducer: {
      auth: (state = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        securityContext: null
      }, action) => {
        switch (action.type) {
          case 'auth/setUser':
            return { ...state, user: action.payload, isAuthenticated: !!action.payload };
          case 'auth/setLoading':
            return { ...state, isLoading: action.payload };
          case 'auth/setError':
            return { ...state, error: action.payload };
          case 'auth/updateSecurityContext':
            return { ...state, securityContext: action.payload };
          case 'auth/clearAuth':
            return {
              isAuthenticated: false,
              isLoading: false,
              user: null,
              error: null,
              securityContext: null
            };
          default:
            return state;
        }
      }
    }
  });

  // Mock AuthService methods
  const mockAuthService = {
    login: jest.fn(),
    logout: jest.fn(),
    getUser: jest.fn(),
    refreshToken: jest.fn(),
    validateSession: jest.fn(),
    getSecurityContext: jest.fn()
  };

  Object.assign(AuthService, mockAuthService);

  // Create wrapper with Provider
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper,
    mockAuthService
  };
};

describe('useAuth Hook Security Features', () => {
  let cleanup: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should initialize with secure default state', () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle secure authentication flow', async () => {
    const { wrapper, mockAuthService } = setupTest();
    mockAuthService.login.mockResolvedValue(undefined);
    mockAuthService.getUser.mockResolvedValue(mockUser);
    mockAuthService.getSecurityContext.mockResolvedValue(mockSecurityContext);
    mockAuthService.validateSession.mockResolvedValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login();
    });

    expect(mockAuthService.login).toHaveBeenCalled();
    expect(mockAuthService.getSecurityContext).toHaveBeenCalled();
    expect(mockAuthService.validateSession).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('should manage token lifecycle', async () => {
    const { wrapper, mockAuthService } = setupTest();
    mockAuthService.getUser.mockResolvedValue(mockUser);
    mockAuthService.refreshToken.mockResolvedValue(undefined);
    mockAuthService.validateSession.mockResolvedValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Setup authenticated state
    await act(async () => {
      await result.current.login();
    });

    // Advance timers to trigger token refresh
    await act(async () => {
      jest.advanceTimersByTime(TOKEN_REFRESH_INTERVAL);
    });

    expect(mockAuthService.refreshToken).toHaveBeenCalled();
    expect(mockAuthService.validateSession).toHaveBeenCalled();
  });

  it('should enforce session security', async () => {
    const { wrapper, mockAuthService } = setupTest();
    mockAuthService.validateSession.mockResolvedValue(true);
    mockAuthService.getUser.mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Setup authenticated state
    await act(async () => {
      await result.current.login();
    });

    // Verify session checks
    await act(async () => {
      jest.advanceTimersByTime(SESSION_CHECK_INTERVAL);
    });

    expect(mockAuthService.validateSession).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);

    // Simulate session validation failure
    mockAuthService.validateSession.mockResolvedValue(false);

    await act(async () => {
      jest.advanceTimersByTime(SESSION_CHECK_INTERVAL);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle security violations', async () => {
    const { wrapper, mockAuthService } = setupTest();
    const securityError = new Error('Security violation detected');
    mockAuthService.login.mockRejectedValue(securityError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login();
      } catch (error) {
        expect(error).toBe(securityError);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should cleanup security monitoring on unmount', async () => {
    const { wrapper, mockAuthService } = setupTest();
    mockAuthService.getUser.mockResolvedValue(mockUser);
    mockAuthService.validateSession.mockResolvedValue(true);

    const { result, unmount } = renderHook(() => useAuth(), { wrapper });

    // Setup authenticated state
    await act(async () => {
      await result.current.login();
    });

    // Unmount hook
    unmount();

    // Advance timers
    jest.advanceTimersByTime(TOKEN_REFRESH_INTERVAL);
    jest.advanceTimersByTime(SESSION_CHECK_INTERVAL);

    // Verify no more calls after unmount
    expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    expect(mockAuthService.validateSession).toHaveBeenCalledTimes(1);
  });
});