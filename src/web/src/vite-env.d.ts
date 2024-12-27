/// <reference types="vite/client" /> // vite ^4.5.0

/**
 * Type definition for Vite's environment variables interface.
 * Extends the default ImportMetaEnv with application-specific environment variables
 * used in the Detection Translation Platform.
 */
interface ImportMetaEnv {
  /**
   * Backend API base URL for the Detection Translation Platform
   * @example 'https://api.detection-translator.com'
   */
  readonly VITE_API_URL: string;

  /**
   * Auth0 domain for authentication integration
   * @example 'detection-translator.auth0.com'
   */
  readonly VITE_AUTH0_DOMAIN: string;

  /**
   * Auth0 client ID for application authentication
   * @example 'your-auth0-client-id'
   */
  readonly VITE_AUTH0_CLIENT_ID: string;

  /**
   * Auth0 API audience identifier for token validation
   * @example 'https://api.detection-translator.com'
   */
  readonly VITE_AUTH0_AUDIENCE: string;

  /**
   * GitHub OAuth client ID for repository integration
   * @example 'your-github-client-id'
   */
  readonly VITE_GITHUB_CLIENT_ID: string;

  /**
   * GitHub OAuth redirect URI for authentication flow
   * @example 'https://detection-translator.com/github/callback'
   */
  readonly VITE_GITHUB_REDIRECT_URI: string;

  /**
   * Vite mode (development/production) for environment-specific behavior
   */
  readonly MODE: string;

  /**
   * Base URL for the application deployment
   * @example '/' or '/detection-translator/'
   */
  readonly BASE_URL: string;

  /**
   * Production mode flag for conditional logic
   */
  readonly PROD: boolean;

  /**
   * Development mode flag for debugging features
   */
  readonly DEV: boolean;
}

/**
 * Type definition for the import.meta object with environment variables
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Ensures type checking for static environment variables in Vite configuration
 */
declare module 'vite/client' {
  interface ImportMetaEnv extends ImportMetaEnv {}
}