// @package jsonwebtoken ^9.0.2
// @package http-errors ^2.0.0

import { sign, verify, JsonWebTokenError } from 'jsonwebtoken';
import { UnauthorizedError } from 'http-errors';
import { authConfig } from '../config/auth';
import crypto from 'crypto';

// Constants for JWT configuration
const JWT_ALGORITHM = 'RS256' as const;
const TOKEN_VERSION = 1;
const MAX_TOKEN_AGE = 3600; // 1 hour in seconds
const REFRESH_WINDOW = 300; // 5 minutes in seconds

/**
 * Interface defining the structure of JWT token payload with enhanced security fields
 */
export interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  exp: number;
  iat: number;
  jti: string;
  version: number;
  issuer: string;
  audience: string;
}

/**
 * Interface for JWT generation options with enhanced security configurations
 */
interface JWTOptions {
  algorithm: string;
  expiresIn: number;
  audience: string;
  issuer: string;
  includeVersion: boolean;
  allowRefresh: boolean;
}

/**
 * Generates a cryptographically secure token ID
 * @returns {string} Unique token identifier
 */
const generateTokenId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validates the token payload structure and required fields
 * @param {TokenPayload} payload - Token payload to validate
 * @throws {Error} If payload validation fails
 */
const validatePayload = (payload: Partial<TokenPayload>): void => {
  const requiredFields = ['userId', 'role', 'permissions'];
  const missingFields = requiredFields.filter(field => !payload[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required payload fields: ${missingFields.join(', ')}`);
  }
};

/**
 * Generates a secure JWT token with RSA-256 encryption and enhanced payload validation
 * @param {TokenPayload} payload - Token payload data
 * @returns {Promise<string>} Generated JWT token
 * @throws {Error} If token generation fails
 */
export const generateToken = async (payload: Partial<TokenPayload>): Promise<string> => {
  try {
    // Validate payload structure
    validatePayload(payload);

    // Generate token ID and timestamp
    const tokenId = generateTokenId();
    const timestamp = Math.floor(Date.now() / 1000);

    // Construct complete payload with security fields
    const completePayload: TokenPayload = {
      ...payload as TokenPayload,
      jti: tokenId,
      iat: timestamp,
      exp: timestamp + MAX_TOKEN_AGE,
      version: TOKEN_VERSION,
      issuer: 'detection-translator-api',
      audience: 'detection-translator-services'
    };

    // Validate private key presence
    if (!authConfig.jwtPrivateKey) {
      throw new Error('JWT private key is not configured');
    }

    // Sign token with RSA private key
    const token = await new Promise<string>((resolve, reject) => {
      sign(completePayload, authConfig.jwtPrivateKey, {
        algorithm: JWT_ALGORITHM,
        keyid: tokenId
      }, (err, token) => {
        if (err || !token) reject(err || new Error('Token generation failed'));
        else resolve(token);
      });
    });

    return token;
  } catch (error) {
    console.error('Token generation failed:', error);
    throw error;
  }
};

/**
 * Comprehensive token verification with multiple security checks
 * @param {string} token - JWT token to verify
 * @returns {Promise<TokenPayload>} Verified and decoded token payload
 * @throws {UnauthorizedError} If token verification fails
 */
export const verifyToken = async (token: string): Promise<TokenPayload> => {
  try {
    // Validate token format
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Invalid token format');
    }

    // Validate public key presence
    if (!authConfig.jwtPublicKey) {
      throw new Error('JWT public key is not configured');
    }

    // Verify token with RSA public key
    const decoded = await new Promise<TokenPayload>((resolve, reject) => {
      verify(token, authConfig.jwtPublicKey, {
        algorithms: [JWT_ALGORITHM],
        complete: true
      }, (err, decoded) => {
        if (err || !decoded) reject(new UnauthorizedError('Token verification failed'));
        else resolve(decoded.payload as TokenPayload);
      });
    });

    // Validate token version
    if (decoded.version !== TOKEN_VERSION) {
      throw new UnauthorizedError('Invalid token version');
    }

    // Validate token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp <= currentTime) {
      throw new UnauthorizedError('Token has expired');
    }

    // Validate issuer and audience
    if (decoded.issuer !== 'detection-translator-api' || 
        decoded.audience !== 'detection-translator-services') {
      throw new UnauthorizedError('Invalid token claims');
    }

    return decoded;
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    }
    throw error;
  }
};

/**
 * Securely refreshes token while maintaining payload integrity
 * @param {string} token - Current JWT token
 * @returns {Promise<string>} New JWT token with updated expiry
 * @throws {UnauthorizedError} If token refresh fails
 */
export const refreshToken = async (token: string): Promise<string> => {
  try {
    // Verify current token
    const decoded = await verifyToken(token);

    // Check if token is within refresh window
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp - currentTime > REFRESH_WINDOW) {
      throw new UnauthorizedError('Token is not eligible for refresh yet');
    }

    // Generate new token with same payload but updated expiry
    const newPayload: Partial<TokenPayload> = {
      userId: decoded.userId,
      role: decoded.role,
      permissions: decoded.permissions
    };

    return await generateToken(newPayload);
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
};