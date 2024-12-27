// @reduxjs/toolkit version: ^1.9.5
// @jest/globals version: ^29.7.0
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import {
  authSlice,
  authActions,
  selectAuth,
  authThunks
} from '../../src/store/authSlice';
import { AuthUser, AuthState, SecurityContext } from '../../src/interfaces/auth';
import { APP_CONFIG } from '../../src/config/constants';

// Test store configuration
const setupStore = () => {
  return configureStore({
    reducer: {
      auth: authSlice.reducer
    }
  });
};

// Mock user data with security context
const mockUser: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['ANALYST', 'ENGINEER'],
  permissions: ['READ', 'TRANSLATE'],
  mfaEnabled: true,
  lastLogin: new Date()
};

// Mock security context
const mockSecurityContext: SecurityContext = {
  lastTokenRefresh: Date.now(),
  tokenExpiresAt: Date.now() + 3600000,
  sessionId: 'test-session-id',
  deviceId: 'test-device-id',
  mfaVerified: true
};

// Initial state for testing
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,
  lastAuthenticated: null,
  securityContext: null,
  sessionTimeout: APP_CONFIG.SESSION_TIMEOUT
};

describe('authSlice', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should return the initial state with security context', () => {
    const state = store.getState().auth;
    expect(state).toEqual(initialState);
    expect(state.sessionTimeout).toBe(APP_CONFIG.SESSION_TIMEOUT);
  });

  it('should handle setAuthState with token validation', () => {
    const timestamp = Date.now();
    store.dispatch(authActions.setAuthState({
      isAuthenticated: true,
      securityContext: mockSecurityContext
    }));

    const state = store.getState().auth;
    expect(state.isAuthenticated).toBe(true);
    expect(state.lastAuthenticated).toBeGreaterThanOrEqual(timestamp);
    expect(state.securityContext).toEqual(mockSecurityContext);
  });

  it('should handle setLoading during authentication', () => {
    store.dispatch(authActions.setLoading(true));
    expect(store.getState().auth.isLoading).toBe(true);

    store.dispatch(authActions.setLoading(false));
    expect(store.getState().auth.isLoading).toBe(false);
  });

  it('should handle setUser with role validation', () => {
    store.dispatch(authActions.setUser(mockUser));
    const state = store.getState().auth;

    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.lastAuthenticated).toBeTruthy();
    expect(state.user?.roles).toContain('ANALYST');
    expect(state.user?.permissions).toContain('READ');
  });

  it('should handle setError with security implications', () => {
    const errorMessage = 'Authentication failed';
    store.dispatch(authActions.setError(errorMessage));
    
    const state = store.getState().auth;
    expect(state.error).toBe(errorMessage);
    expect(state.isAuthenticated).toBe(false);
  });

  it('should handle clearAuth with session cleanup', () => {
    // Setup authenticated state first
    store.dispatch(authActions.setUser(mockUser));
    store.dispatch(authActions.updateSecurityContext(mockSecurityContext));

    // Clear auth
    store.dispatch(authActions.clearAuth());
    const state = store.getState().auth;

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.securityContext).toBeNull();
    expect(state.lastAuthenticated).toBeNull();
  });

  it('should handle updateSecurityContext', () => {
    const newContext = {
      ...mockSecurityContext,
      lastTokenRefresh: Date.now()
    };

    store.dispatch(authActions.updateSecurityContext(newContext));
    const state = store.getState().auth;

    expect(state.securityContext).toEqual(newContext);
    expect(state.securityContext?.lastTokenRefresh).toBeTruthy();
  });

  it('should handle refreshSession with timeout validation', () => {
    // Setup authenticated state
    store.dispatch(authActions.setUser(mockUser));
    const initialTimestamp = Date.now() - (APP_CONFIG.SESSION_TIMEOUT + 1000);
    
    store.dispatch(authActions.setAuthState({
      lastAuthenticated: initialTimestamp
    }));

    store.dispatch(authActions.refreshSession());
    const state = store.getState().auth;

    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Session expired');
  });

  it('should validate state immutability', () => {
    const initialState = store.getState().auth;
    store.dispatch(authActions.setUser(mockUser));
    
    expect(store.getState().auth).not.toBe(initialState);
    expect(initialState.user).toBeNull();
  });

  it('should track security events', () => {
    const events: string[] = [];
    store.subscribe(() => {
      const state = store.getState().auth;
      if (state.securityContext?.lastTokenRefresh) {
        events.push('token_refresh');
      }
    });

    store.dispatch(authActions.updateSecurityContext(mockSecurityContext));
    expect(events).toContain('token_refresh');
  });
});

describe('auth selectors', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
  });

  it('should select isAuthenticated state with token validation', () => {
    store.dispatch(authActions.setUser(mockUser));
    const isAuthenticated = selectAuth.selectIsAuthenticated(store.getState());
    expect(isAuthenticated).toBe(true);
  });

  it('should select user state with role verification', () => {
    store.dispatch(authActions.setUser(mockUser));
    const user = selectAuth.selectUser(store.getState());
    
    expect(user).toEqual(mockUser);
    expect(user?.roles).toContain('ANALYST');
    expect(user?.permissions).toContain('READ');
  });

  it('should select isLoading state during security operations', () => {
    store.dispatch(authActions.setLoading(true));
    const isLoading = selectAuth.selectIsLoading(store.getState());
    expect(isLoading).toBe(true);
  });

  it('should select error state with security context', () => {
    const errorMessage = 'Security violation detected';
    store.dispatch(authActions.setError(errorMessage));
    const error = selectAuth.selectError(store.getState());
    expect(error).toBe(errorMessage);
  });

  it('should select security context', () => {
    store.dispatch(authActions.updateSecurityContext(mockSecurityContext));
    const context = selectAuth.selectSecurityContext(store.getState());
    expect(context).toEqual(mockSecurityContext);
  });

  it('should select session validity with timeout', () => {
    store.dispatch(authActions.setUser(mockUser));
    const validity = selectAuth.selectSessionValidity(store.getState());
    
    expect(validity).toHaveProperty('isValid');
    expect(validity).toHaveProperty('timeRemaining');
    expect(validity.timeRemaining).toBeLessThanOrEqual(APP_CONFIG.SESSION_TIMEOUT);
  });

  it('should handle selector recomputation', () => {
    const getIsAuthenticated = () => selectAuth.selectIsAuthenticated(store.getState());
    
    const initial = getIsAuthenticated();
    store.dispatch(authActions.setUser(mockUser));
    const after = getIsAuthenticated();

    expect(initial).toBe(false);
    expect(after).toBe(true);
  });
});