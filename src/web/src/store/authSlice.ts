// @reduxjs/toolkit version: ^1.9.5
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { AuthUser, AuthState, AuthToken, SecurityContext } from '../interfaces/auth';
import { AuthService } from '../services/auth';
import { logger } from '../utils/logger';

// Constants for authentication state management
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const TOKEN_REFRESH_BUFFER = 300000; // 5 minutes before token expiry
const SECURITY_EVENT_TYPES = {
  LOGIN: 'auth/login',
  LOGOUT: 'auth/logout',
  TOKEN_REFRESH: 'auth/tokenRefresh',
  SESSION_EXPIRED: 'auth/sessionExpired',
  SECURITY_VIOLATION: 'auth/securityViolation'
} as const;

// Initial state with enhanced security context
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,
  lastAuthenticated: null,
  securityContext: null,
  sessionTimeout: SESSION_TIMEOUT
};

/**
 * Enhanced Redux Toolkit slice for authentication state management
 * Implements secure token lifecycle, session monitoring, and security event tracking
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      logger.info('Auth loading state changed', { isLoading: action.payload });
    },

    setAuthState: (state, action: PayloadAction<Partial<AuthState>>) => {
      const timestamp = Date.now();
      Object.assign(state, {
        ...action.payload,
        lastAuthenticated: timestamp
      });
      logger.info('Auth state updated', { timestamp });
    },

    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.lastAuthenticated = action.payload ? Date.now() : null;
      logger.info('User state updated', { 
        isAuthenticated: state.isAuthenticated,
        userId: action.payload?.id 
      });
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      logger.error('Auth error occurred', { error: action.payload });
    },

    updateSecurityContext: (state, action: PayloadAction<SecurityContext>) => {
      state.securityContext = {
        ...state.securityContext,
        ...action.payload,
        lastUpdated: Date.now()
      };
      logger.info('Security context updated', { 
        context: state.securityContext 
      });
    },

    clearAuth: (state) => {
      Object.assign(state, {
        ...initialState,
        lastAuthenticated: null
      });
      logger.info('Auth state cleared');
    },

    refreshSession: (state) => {
      if (state.isAuthenticated && state.lastAuthenticated) {
        const sessionAge = Date.now() - state.lastAuthenticated;
        if (sessionAge >= state.sessionTimeout) {
          Object.assign(state, {
            ...initialState,
            error: 'Session expired'
          });
          logger.warn('Session expired', { sessionAge });
        }
      }
    }
  }
});

// Export actions for component usage
export const authActions = authSlice.actions;

// Enhanced selectors with memoization and security validation
export const selectAuth = {
  selectIsAuthenticated: createSelector(
    [(state: { auth: AuthState }) => state.auth],
    (auth): boolean => {
      const isValid = auth.isAuthenticated && 
        auth.lastAuthenticated && 
        (Date.now() - auth.lastAuthenticated) < auth.sessionTimeout;
      return isValid;
    }
  ),

  selectUser: createSelector(
    [(state: { auth: AuthState }) => state.auth],
    (auth): AuthUser | null => auth.user
  ),

  selectIsLoading: createSelector(
    [(state: { auth: AuthState }) => state.auth],
    (auth): boolean => auth.isLoading
  ),

  selectError: createSelector(
    [(state: { auth: AuthState }) => state.auth],
    (auth): string | null => auth.error
  ),

  selectSecurityContext: createSelector(
    [(state: { auth: AuthState }) => state.auth],
    (auth): SecurityContext | null => auth.securityContext
  ),

  selectSessionValidity: createSelector(
    [(state: { auth: AuthState }) => state.auth],
    (auth): { isValid: boolean; timeRemaining: number } => {
      const lastAuth = auth.lastAuthenticated || 0;
      const timeRemaining = Math.max(0, auth.sessionTimeout - (Date.now() - lastAuth));
      return {
        isValid: timeRemaining > 0,
        timeRemaining
      };
    }
  )
};

// Thunk action creators for async operations
export const authThunks = {
  /**
   * Initialize authentication state with security validation
   */
  initializeAuth: () => async (dispatch: any) => {
    try {
      dispatch(authActions.setLoading(true));
      const token = await AuthService.getToken();
      if (token) {
        const user = await AuthService.getUser();
        dispatch(authActions.setUser(user));
        dispatch(authActions.updateSecurityContext({
          lastTokenRefresh: Date.now(),
          tokenExpiresAt: token.expiresAt
        }));
      }
    } catch (error) {
      logger.error('Auth initialization failed', { error });
      dispatch(authActions.setError('Authentication initialization failed'));
    } finally {
      dispatch(authActions.setLoading(false));
    }
  },

  /**
   * Handle secure session refresh with token rotation
   */
  refreshAuthSession: () => async (dispatch: any, getState: any) => {
    try {
      const { auth } = getState();
      if (!auth.isAuthenticated) return;

      dispatch(authActions.setLoading(true));
      await AuthService.refreshToken();
      const token = await AuthService.getToken();
      
      if (token) {
        dispatch(authActions.updateSecurityContext({
          lastTokenRefresh: Date.now(),
          tokenExpiresAt: token.expiresAt
        }));
        logger.info('Auth session refreshed successfully');
      }
    } catch (error) {
      logger.error('Session refresh failed', { error });
      dispatch(authActions.setError('Session refresh failed'));
      dispatch(authActions.clearAuth());
    } finally {
      dispatch(authActions.setLoading(false));
    }
  }
};

// Export reducer for store configuration
export default authSlice.reducer;