// @auth0/auth0-spa-js version: ^2.1.0
// crypto-js version: ^4.1.1
import { Auth0Client } from '@auth0/auth0-spa-js';
import * as CryptoJS from 'crypto-js';
import { AuthConfig } from '../interfaces/auth';
import { StorageKeys, StorageType } from '../utils/storage';

/**
 * Token expiry buffer in milliseconds (5 minutes)
 * Used to refresh tokens before they actually expire
 */
const TOKEN_EXPIRY_BUFFER = 300000;

/**
 * Default OAuth scope for authentication
 */
const DEFAULT_SCOPE = 'openid profile email';

/**
 * Encryption algorithm for secure token storage
 */
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';

/**
 * Maximum token age in milliseconds (1 hour)
 */
const MAX_TOKEN_AGE = 3600000;

/**
 * Interface for enhanced authentication configuration options
 */
interface AuthOptions {
  /**
   * Type of storage to use for tokens
   */
  tokenStorageType: StorageType;
  
  /**
   * Window in milliseconds before token expiry to trigger refresh
   */
  tokenRefreshWindow: number;
  
  /**
   * Whether to use encrypted storage for tokens
   */
  useSecureStorage: boolean;
  
  /**
   * Key used for token encryption
   */
  encryptionKey: string;
  
  /**
   * Whether MFA is enabled
   */
  mfaEnabled: boolean;
  
  /**
   * Session timeout in milliseconds
   */
  sessionTimeout: number;
}

/**
 * Auth0 configuration object with production settings
 */
export const auth0Config: AuthConfig = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  scope: DEFAULT_SCOPE,
  mfaConfig: {
    enabled: true,
    methods: ['otp', 'push'],
    timeoutSeconds: 300
  }
};

/**
 * Enhanced authentication options with security controls
 */
export const authOptions: AuthOptions = {
  tokenStorageType: StorageType.SECURE_SESSION,
  tokenRefreshWindow: TOKEN_EXPIRY_BUFFER,
  useSecureStorage: true,
  encryptionKey: process.env.REACT_APP_TOKEN_ENCRYPTION_KEY || '',
  mfaEnabled: true,
  sessionTimeout: MAX_TOKEN_AGE
};

/**
 * Creates and configures a secure Auth0 client instance with enhanced security features
 * @param config - Auth0 configuration
 * @param options - Authentication options
 * @returns Configured Auth0 client instance with security enhancements
 */
export async function createAuth0Client(
  config: AuthConfig,
  options: AuthOptions
): Promise<Auth0Client> {
  // Validate configuration
  if (!config.domain || !config.clientId) {
    throw new Error('Invalid Auth0 configuration: Missing required parameters');
  }

  // Validate encryption key if secure storage is enabled
  if (options.useSecureStorage && !options.encryptionKey) {
    throw new Error('Encryption key is required when using secure storage');
  }

  // Configure secure token encryption
  const encryptToken = (token: string): string => {
    return CryptoJS.AES.encrypt(token, options.encryptionKey, {
      mode: CryptoJS.mode.GCM
    }).toString();
  };

  // Configure secure token decryption
  const decryptToken = (encryptedToken: string): string => {
    return CryptoJS.AES.decrypt(encryptedToken, options.encryptionKey, {
      mode: CryptoJS.mode.GCM
    }).toString(CryptoJS.enc.Utf8);
  };

  // Initialize Auth0 client with enhanced security options
  const client = await new Auth0Client({
    domain: config.domain,
    client_id: config.clientId,
    audience: config.audience,
    scope: config.scope,
    cacheLocation: options.tokenStorageType === StorageType.SECURE_SESSION ? 'memory' : 'localstorage',
    useRefreshTokens: true,
    useRefreshTokensFallback: true,
    advancedOptions: {
      defaultScope: DEFAULT_SCOPE
    },
    auth0Client: {
      name: 'detection-translator',
      version: process.env.REACT_APP_VERSION
    }
  });

  // Configure automatic token refresh
  const scheduleTokenRefresh = async () => {
    const token = await client.getTokenSilently();
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = (decodedToken.exp * 1000) - Date.now();
    
    if (expiresIn > options.tokenRefreshWindow) {
      setTimeout(async () => {
        try {
          await client.getTokenSilently();
          scheduleTokenRefresh();
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }, expiresIn - options.tokenRefreshWindow);
    }
  };

  // Configure secure token storage
  if (options.useSecureStorage) {
    const originalGetToken = client.getTokenSilently.bind(client);
    client.getTokenSilently = async (...args) => {
      const token = await originalGetToken(...args);
      const encryptedToken = encryptToken(token);
      sessionStorage.setItem(StorageKeys.AUTH_TOKEN, encryptedToken);
      return token;
    };
  }

  // Configure MFA if enabled
  if (options.mfaEnabled) {
    const originalGetToken = client.getTokenSilently.bind(client);
    client.getTokenSilently = async (...args) => {
      try {
        return await originalGetToken(...args);
      } catch (error: any) {
        if (error.error === 'mfa_required') {
          // Trigger MFA challenge
          await client.loginWithPopup({
            acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'
          });
          return await originalGetToken(...args);
        }
        throw error;
      }
    };
  }

  // Initialize token refresh mechanism
  await scheduleTokenRefresh();

  return client;
}