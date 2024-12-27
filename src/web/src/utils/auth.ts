// @auth0/auth0-spa-js version: 2.1.0
// jwt-decode version: 3.1.2
// crypto-js version: 4.1.1

import { Auth0Client } from '@auth0/auth0-spa-js';
import jwtDecode from 'jwt-decode';
import * as CryptoJS from 'crypto-js';
import { auth0Config } from '../config/auth';
import { AuthUser, AuthToken, TokenType, AuthError } from '../interfaces/auth';
import { StorageManager, StorageType } from './storage';

// Constants for security configuration
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes in milliseconds
const MAX_TOKEN_AGE = 3600000; // 1 hour in milliseconds
const ENCRYPTION_KEY_ROTATION = 86400000; // 24 hours in milliseconds
const MAX_FAILED_AUTH_ATTEMPTS = 5;
const MFA_CHALLENGE_TIMEOUT = 300000; // 5 minutes in milliseconds

// Initialize secure storage manager
const secureStorage = new StorageManager(StorageType.SESSION, {
  encrypt: true,
  compress: true
});

/**
 * Interface for session security context
 */
interface SecurityContext {
  deviceFingerprint: string;
  lastAuthenticated: number;
  failedAttempts: number;
  mfaVerified: boolean;
}

/**
 * Class for managing authentication state and security
 */
class AuthenticationManager {
  private auth0Client: Auth0Client | null = null;
  private securityContext: SecurityContext | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  /**
   * Generates a device fingerprint for session validation
   * @returns Device fingerprint string
   */
  private generateDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.colorDepth,
      screen.width + 'x' + screen.height
    ];
    return CryptoJS.SHA256(components.join('|')).toString();
  }

  /**
   * Validates the security context of the current session
   * @throws {Error} If security context is invalid
   */
  private validateSecurityContext(): void {
    if (!this.securityContext) {
      throw new Error('Security context not initialized');
    }

    const currentFingerprint = this.generateDeviceFingerprint();
    if (currentFingerprint !== this.securityContext.deviceFingerprint) {
      throw new Error('Invalid session fingerprint');
    }

    const sessionAge = Date.now() - this.securityContext.lastAuthenticated;
    if (sessionAge > MAX_TOKEN_AGE) {
      throw new Error('Session expired');
    }
  }

  /**
   * Encrypts sensitive token data
   * @param token - Token to encrypt
   * @returns Encrypted token string
   */
  private encryptToken(token: string): string {
    const encryptionKey = CryptoJS.SHA256(Date.now().toString()).toString();
    const encrypted = CryptoJS.AES.encrypt(token, encryptionKey, {
      mode: CryptoJS.mode.GCM
    });
    
    secureStorage.setItem('encryption_key', encryptionKey, {
      expiresIn: ENCRYPTION_KEY_ROTATION / 1000
    });
    
    return encrypted.toString();
  }

  /**
   * Decrypts token data
   * @param encryptedToken - Encrypted token string
   * @returns Decrypted token string
   */
  private decryptToken(encryptedToken: string): string {
    const encryptionKey = secureStorage.getItem<string>('encryption_key');
    if (!encryptionKey) {
      throw new Error('Encryption key not found');
    }

    const decrypted = CryptoJS.AES.decrypt(encryptedToken, encryptionKey, {
      mode: CryptoJS.mode.GCM
    });
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Initializes the Auth0 client with enhanced security configuration
   * @returns Initialized Auth0 client instance
   */
  public async initializeAuth(): Promise<Auth0Client> {
    if (this.auth0Client) {
      return this.auth0Client;
    }

    this.securityContext = {
      deviceFingerprint: this.generateDeviceFingerprint(),
      lastAuthenticated: Date.now(),
      failedAttempts: 0,
      mfaVerified: false
    };

    this.auth0Client = new Auth0Client({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      audience: auth0Config.audience,
      cacheLocation: 'memory',
      useRefreshTokens: true,
      advancedOptions: {
        defaultScope: 'openid profile email'
      }
    });

    return this.auth0Client;
  }

  /**
   * Handles authentication token processing and security validation
   * @param token - Authentication token
   * @returns Processed and validated auth token
   */
  public async handleAuthToken(token: string): Promise<AuthToken> {
    this.validateSecurityContext();

    const decodedToken: any = jwtDecode(token);
    const now = Date.now();

    if (decodedToken.exp * 1000 < now) {
      throw new Error('Token expired');
    }

    const authToken: AuthToken = {
      accessToken: token,
      tokenType: TokenType.Bearer,
      expiresAt: decodedToken.exp * 1000,
      issuedAt: decodedToken.iat * 1000,
      refreshToken: ''
    };

    // Store encrypted token
    const encryptedToken = this.encryptToken(token);
    secureStorage.setItem('auth_token', encryptedToken, {
      expiresIn: (authToken.expiresAt - now) / 1000
    });

    // Schedule token refresh
    this.scheduleTokenRefresh(authToken.expiresAt);

    return authToken;
  }

  /**
   * Schedules automatic token refresh before expiration
   * @param expiresAt - Token expiration timestamp
   */
  private scheduleTokenRefresh(expiresAt: number): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    const refreshTime = expiresAt - Date.now() - TOKEN_REFRESH_THRESHOLD;
    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(async () => {
        try {
          if (this.auth0Client) {
            const newToken = await this.auth0Client.getTokenSilently();
            await this.handleAuthToken(newToken);
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }, refreshTime);
    }
  }

  /**
   * Handles MFA verification process
   * @returns Promise resolving to MFA verification status
   */
  public async handleMFAChallenge(): Promise<boolean> {
    if (!this.auth0Client || !auth0Config.mfaConfig.enabled) {
      return false;
    }

    try {
      await this.auth0Client.loginWithPopup({
        acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
      });
      
      this.securityContext!.mfaVerified = true;
      return true;
    } catch (error) {
      this.securityContext!.failedAttempts++;
      if (this.securityContext!.failedAttempts >= MAX_FAILED_AUTH_ATTEMPTS) {
        throw new Error('Maximum MFA attempts exceeded');
      }
      return false;
    }
  }

  /**
   * Cleans up authentication state and security context
   */
  public cleanup(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    secureStorage.removeItem('auth_token');
    secureStorage.removeItem('encryption_key');
    this.securityContext = null;
    this.auth0Client = null;
  }
}

// Export singleton instance
export const authManager = new AuthenticationManager();