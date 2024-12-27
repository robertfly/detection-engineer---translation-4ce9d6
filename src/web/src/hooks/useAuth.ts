// @auth0/auth0-react version: ^2.0.0
// react-redux version: ^8.1.0
// react version: ^18.2.0

import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useRef } from 'react';
import { AuthUser, AuthState, SecurityContext } from '../interfaces/auth';
import { AuthService } from '../services/auth';
import { logger } from '../utils/logger';
import { APP_CONFIG } from '../config/constants';

// Constants for security and token management
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_CHECK_INTERVAL = 60 * 1000; // 1 minute
const MAX_SESSION_DURATION = APP_CONFIG.SESSION_TIMEOUT * 1000;

/**
 * Enhanced authentication hook with comprehensive security features
 * Implements OAuth 2.0 with Auth0, role-based authorization, and security monitoring
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  const securityCheckInterval = useRef<NodeJS.Timeout>();
  const tokenRefreshInterval = useRef<NodeJS.Timeout>();

  /**
   * Enhanced secure login handler with validation and monitoring
   */
  const handleSecureLogin = useCallback(async () => {
    try {
      dispatch({ type: 'auth/loginStart' });
      logger.info('Initiating secure login process');

      // Clear any existing sessions for security
      await handleSecureLogout();

      // Initialize security context
      const securityContext = await AuthService.getSecurityContext();
      if (!securityContext) {
        throw new Error('Failed to initialize security context');
      }

      // Perform secure login
      await AuthService.login();

      // Validate session integrity
      const sessionValid = await validateSecurityContext();
      if (!sessionValid) {
        throw new Error('Security context validation failed');
      }

      logger.info('Login successful', { userId: securityContext.userId });
      dispatch({ 
        type: 'auth/loginSuccess',
        payload: { securityContext }
      });
    } catch (error) {
      logger.error('Login failed', { error });
      dispatch({ 
        type: 'auth/loginFailure',
        payload: { error: error instanceof Error ? error.message : 'Login failed' }
      });
      throw error;
    }
  }, [dispatch]);

  /**
   * Enhanced secure logout handler with cleanup
   */
  const handleSecureLogout = useCallback(async () => {
    try {
      logger.info('Initiating secure logout process');
      
      // Clear security intervals
      if (securityCheckInterval.current) {
        clearInterval(securityCheckInterval.current);
      }
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }

      // Perform secure logout
      await AuthService.logout();
      
      // Clear security context
      dispatch({ type: 'auth/logout' });
      
      logger.info('Logout completed successfully');
    } catch (error) {
      logger.error('Logout failed', { error });
      // Force logout on error for security
      dispatch({ type: 'auth/logout' });
    }
  }, [dispatch]);

  /**
   * Validates security context and session integrity
   */
  const validateSecurityContext = useCallback(async (): Promise<boolean> => {
    try {
      // Verify user session
      const user = await AuthService.getUser();
      if (!user) {
        logger.warn('Invalid user session detected');
        return false;
      }

      // Validate session duration
      const sessionStart = new Date(user.lastLogin).getTime();
      if (Date.now() - sessionStart > MAX_SESSION_DURATION) {
        logger.warn('Session duration exceeded maximum limit');
        return false;
      }

      // Validate token
      const isValid = await AuthService.validateSession();
      if (!isValid) {
        logger.warn('Invalid session token detected');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Security context validation failed', { error });
      return false;
    }
  }, []);

  /**
   * Refreshes authentication token with security validation
   */
  const handleTokenRefresh = useCallback(async () => {
    try {
      logger.info('Initiating token refresh');
      await AuthService.refreshToken();
      
      // Validate refreshed session
      const isValid = await validateSecurityContext();
      if (!isValid) {
        throw new Error('Session validation failed after token refresh');
      }
      
      logger.info('Token refresh completed successfully');
    } catch (error) {
      logger.error('Token refresh failed', { error });
      // Force logout on token refresh failure
      await handleSecureLogout();
    }
  }, [handleSecureLogout, validateSecurityContext]);

  /**
   * Sets up security monitoring and token refresh intervals
   */
  const setupSecurityMonitoring = useCallback(() => {
    // Clear existing intervals
    if (securityCheckInterval.current) {
      clearInterval(securityCheckInterval.current);
    }
    if (tokenRefreshInterval.current) {
      clearInterval(tokenRefreshInterval.current);
    }

    // Setup security check interval
    securityCheckInterval.current = setInterval(async () => {
      const isValid = await validateSecurityContext();
      if (!isValid) {
        logger.warn('Security check failed, initiating logout');
        await handleSecureLogout();
      }
    }, SESSION_CHECK_INTERVAL);

    // Setup token refresh interval
    tokenRefreshInterval.current = setInterval(async () => {
      await handleTokenRefresh();
    }, TOKEN_REFRESH_INTERVAL);
  }, [handleSecureLogout, handleTokenRefresh, validateSecurityContext]);

  /**
   * Cleanup security monitoring on unmount
   */
  useEffect(() => {
    return () => {
      if (securityCheckInterval.current) {
        clearInterval(securityCheckInterval.current);
      }
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }
    };
  }, []);

  /**
   * Initialize security monitoring when authenticated
   */
  useEffect(() => {
    if (authState.isAuthenticated) {
      setupSecurityMonitoring();
    }
  }, [authState.isAuthenticated, setupSecurityMonitoring]);

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    error: authState.error,
    login: handleSecureLogin,
    logout: handleSecureLogout,
    validateSession: validateSecurityContext,
    refreshToken: handleTokenRefresh
  };
};

export type { AuthUser, AuthState, SecurityContext };