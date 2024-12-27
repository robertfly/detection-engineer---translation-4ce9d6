// @auth0/auth0-spa-js version: ^2.1.0
import { Auth0Client, Auth0ClientOptions } from '@auth0/auth0-spa-js';
import { AuthUser, AuthState, AuthToken, AuthConfig } from '../interfaces/auth';
import { auth0Config, authOptions } from '../config/auth';
import { setLocalStorage, getLocalStorage, removeStorage, StorageType } from '../utils/storage';
import { setAuthToken } from '../utils/api';
import { logger } from '../utils/logger';

// Constants for authentication management
const AUTH_STORAGE_KEY = 'auth_token';
const TOKEN_REFRESH_BUFFER = 300000; // 5 minutes in milliseconds
const MAX_LOGIN_ATTEMPTS = 3;
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

/**
 * Decorator for rate limiting authentication attempts
 */
function rateLimit(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  let attempts = 0;
  let lastAttempt = 0;

  descriptor.value = async function(...args: any[]) {
    const now = Date.now();
    if (now - lastAttempt < 1000) { // 1 second cooldown
      throw new Error('Too many authentication attempts. Please try again later.');
    }
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error('Maximum login attempts exceeded. Please try again later.');
    }
    lastAttempt = now;
    attempts++;
    try {
      const result = await original.apply(this, args);
      attempts = 0; // Reset on success
      return result;
    } catch (error) {
      logger.error('Authentication attempt failed', { error });
      throw error;
    }
  };
  return descriptor;
}

/**
 * Decorator for validating authentication session
 */
function validateSession(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const token = await this.getToken();
    if (!token) {
      throw new Error('No valid session found');
    }
    if (Date.now() >= token.expiresAt - TOKEN_REFRESH_BUFFER) {
      await this.refreshToken();
    }
    return original.apply(this, args);
  };
  return descriptor;
}

/**
 * Authentication service class implementing secure OAuth 2.0 with Auth0
 */
class AuthService {
  private auth0Client: Auth0Client | null = null;
  private refreshPromise: Promise<void> | null = null;

  /**
   * Initializes the Auth0 client with enhanced security configuration
   */
  public async initializeAuth(): Promise<Auth0Client> {
    try {
      if (!auth0Config.domain || !auth0Config.clientId) {
        throw new Error('Auth0 configuration is incomplete');
      }

      const options: Auth0ClientOptions = {
        domain: auth0Config.domain,
        client_id: auth0Config.clientId,
        audience: auth0Config.audience,
        scope: 'openid profile email',
        cacheLocation: 'memory',
        useRefreshTokens: true,
        advancedOptions: {
          defaultScope: auth0Config.scope
        }
      };

      this.auth0Client = new Auth0Client(options);
      logger.info('Auth0 client initialized successfully');
      return this.auth0Client;
    } catch (error) {
      logger.error('Failed to initialize Auth0 client', { error });
      throw error;
    }
  }

  /**
   * Initiates secure Auth0 login process with MFA support
   */
  @rateLimit
  public async login(): Promise<void> {
    try {
      if (!this.auth0Client) {
        await this.initializeAuth();
      }

      await this.auth0Client!.loginWithRedirect({
        acr_values: auth0Config.mfaConfig.enabled ? 
          'http://schemas.openid.net/pape/policies/2007/06/multi-factor' : undefined,
        max_age: SESSION_TIMEOUT / 1000
      });

      logger.info('Login initiated successfully');
    } catch (error) {
      logger.error('Login failed', { error });
      throw error;
    }
  }

  /**
   * Handles authentication callback and token storage
   */
  public async handleCallback(): Promise<void> {
    try {
      if (!this.auth0Client) {
        await this.initializeAuth();
      }

      const result = await this.auth0Client!.handleRedirectCallback();
      const token = await this.auth0Client!.getTokenSilently();
      
      const authToken: AuthToken = {
        accessToken: token,
        tokenType: 'Bearer',
        expiresAt: Date.now() + SESSION_TIMEOUT,
        issuedAt: Date.now(),
        refreshToken: result.refresh_token || ''
      };

      await this.storeToken(authToken);
      setAuthToken(authToken);
      
      logger.info('Authentication callback handled successfully');
    } catch (error) {
      logger.error('Failed to handle authentication callback', { error });
      throw error;
    }
  }

  /**
   * Securely logs out user and cleans up session data
   */
  public async logout(): Promise<void> {
    try {
      if (!this.auth0Client) {
        await this.initializeAuth();
      }

      await this.auth0Client!.logout({
        returnTo: window.location.origin
      });

      await this.clearSession();
      logger.info('Logout completed successfully');
    } catch (error) {
      logger.error('Logout failed', { error });
      throw error;
    }
  }

  /**
   * Retrieves and validates current user information
   */
  @validateSession
  public async getUser(): Promise<AuthUser | null> {
    try {
      if (!this.auth0Client) {
        await this.initializeAuth();
      }

      const user = await this.auth0Client!.getUser();
      if (!user) {
        return null;
      }

      const authUser: AuthUser = {
        id: user.sub!,
        email: user.email!,
        name: user.name!,
        roles: user['https://detection-translator/roles'] || [],
        permissions: user['https://detection-translator/permissions'] || [],
        mfaEnabled: auth0Config.mfaConfig.enabled,
        lastLogin: new Date(user.updated_at!)
      };

      return authUser;
    } catch (error) {
      logger.error('Failed to get user information', { error });
      throw error;
    }
  }

  /**
   * Securely retrieves and validates authentication token
   */
  public async getToken(): Promise<AuthToken | null> {
    try {
      const storedToken = await getLocalStorage<AuthToken>(AUTH_STORAGE_KEY);
      if (!storedToken || Date.now() >= storedToken.expiresAt) {
        return null;
      }
      return storedToken;
    } catch (error) {
      logger.error('Failed to get authentication token', { error });
      return null;
    }
  }

  /**
   * Refreshes the authentication token
   */
  private async refreshToken(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (!this.auth0Client) {
          await this.initializeAuth();
        }

        const token = await this.auth0Client!.getTokenSilently({
          timeoutInSeconds: 60
        });

        const authToken: AuthToken = {
          accessToken: token,
          tokenType: 'Bearer',
          expiresAt: Date.now() + SESSION_TIMEOUT,
          issuedAt: Date.now(),
          refreshToken: ''
        };

        await this.storeToken(authToken);
        setAuthToken(authToken);
        
        logger.info('Token refreshed successfully');
      } catch (error) {
        logger.error('Token refresh failed', { error });
        await this.clearSession();
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Securely stores authentication token
   */
  private async storeToken(token: AuthToken): Promise<void> {
    try {
      await setLocalStorage(AUTH_STORAGE_KEY, token, {
        encrypt: true,
        expiresIn: SESSION_TIMEOUT
      });
    } catch (error) {
      logger.error('Failed to store authentication token', { error });
      throw error;
    }
  }

  /**
   * Clears all session data
   */
  private async clearSession(): Promise<void> {
    try {
      await removeStorage(AUTH_STORAGE_KEY);
      this.auth0Client = null;
      logger.info('Session cleared successfully');
    } catch (error) {
      logger.error('Failed to clear session', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();