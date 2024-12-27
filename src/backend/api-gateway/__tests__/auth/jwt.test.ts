// @package jest ^29.7.0
// @package jsonwebtoken ^9.0.2

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { verify } from 'jsonwebtoken';
import { 
  generateToken, 
  verifyToken, 
  refreshToken, 
  TokenPayload,
  blacklistToken,
  validateTokenVersion,
  getAuditLog
} from '../../src/auth/jwt';
import { authConfig } from '../../src/config/auth';

// Test constants
const TEST_USER_PAYLOAD: Partial<TokenPayload> = {
  userId: 'test-user-123',
  role: 'engineer',
  permissions: ['create:detection', 'edit:detection'],
  version: 1,
  issuer: 'detection-translator-api',
  audience: 'detection-translator-services'
};

const MOCK_JWT_CONFIG = {
  algorithm: 'RS256',
  expiresIn: 3600,
  refreshWindow: 300,
  tokenVersion: '1.0',
  auditEnabled: true
};

describe('JWT Authentication', () => {
  // Mock functions
  const mockAuditLog = jest.fn();
  const mockBlacklist = new Set<string>();

  beforeEach(() => {
    // Reset mocks and test state
    jest.clearAllMocks();
    mockBlacklist.clear();
    mockAuditLog.mockClear();

    // Mock auth config
    jest.spyOn(authConfig, 'jwtPrivateKey', 'get').mockReturnValue(
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----'
    );
    jest.spyOn(authConfig, 'jwtPublicKey', 'get').mockReturnValue(
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0...\n-----END PUBLIC KEY-----'
    );
  });

  test('token generation with security features', async () => {
    // Test token generation with full security features
    const token = await generateToken(TEST_USER_PAYLOAD);
    
    // Verify token structure and encryption
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    // Decode and verify token contents
    const decoded = verify(token, authConfig.jwtPublicKey, { 
      algorithms: ['RS256'],
      complete: true 
    });
    
    expect(decoded).toBeDefined();
    expect(decoded.header.alg).toBe('RS256');
    expect(decoded.header.kid).toBeDefined();
    
    const payload = decoded.payload as TokenPayload;
    expect(payload.userId).toBe(TEST_USER_PAYLOAD.userId);
    expect(payload.role).toBe(TEST_USER_PAYLOAD.role);
    expect(payload.permissions).toEqual(TEST_USER_PAYLOAD.permissions);
    expect(payload.version).toBe(1);
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.jti).toBeDefined();
    
    // Verify audit log
    expect(mockAuditLog).toHaveBeenCalledWith({
      action: 'token_generated',
      userId: TEST_USER_PAYLOAD.userId,
      tokenId: payload.jti,
      timestamp: expect.any(Number)
    });
  });

  test('comprehensive token verification', async () => {
    // Generate test token
    const token = await generateToken(TEST_USER_PAYLOAD);
    
    // Test successful verification
    const verified = await verifyToken(token);
    expect(verified).toBeDefined();
    expect(verified.userId).toBe(TEST_USER_PAYLOAD.userId);
    
    // Test invalid token format
    await expect(verifyToken('')).rejects.toThrow('Invalid token format');
    await expect(verifyToken('invalid.token.format')).rejects.toThrow('Invalid token');
    
    // Test expired token
    const expiredToken = await generateToken({
      ...TEST_USER_PAYLOAD,
      exp: Math.floor(Date.now() / 1000) - 3600
    });
    await expect(verifyToken(expiredToken)).rejects.toThrow('Token has expired');
    
    // Test blacklisted token
    mockBlacklist.add(token);
    await expect(verifyToken(token)).rejects.toThrow('Token has been blacklisted');
    
    // Test version mismatch
    const invalidVersionToken = await generateToken({
      ...TEST_USER_PAYLOAD,
      version: 0
    });
    await expect(verifyToken(invalidVersionToken)).rejects.toThrow('Invalid token version');
  });

  test('secure token refresh process', async () => {
    // Generate initial token
    const initialToken = await generateToken(TEST_USER_PAYLOAD);
    
    // Mock token approaching expiry
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return (Math.floor(Date.now() / 1000) + 3300) * 1000; // 5 minutes before expiry
    });
    
    // Test successful refresh
    const newToken = await refreshToken(initialToken);
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(initialToken);
    
    // Verify new token
    const verified = await verifyToken(newToken);
    expect(verified.userId).toBe(TEST_USER_PAYLOAD.userId);
    expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    
    // Verify old token is blacklisted
    expect(mockBlacklist.has(initialToken)).toBe(true);
    
    // Test refresh outside window
    jest.spyOn(Date, 'now').mockImplementation(() => Date.now());
    await expect(refreshToken(newToken)).rejects.toThrow('Token is not eligible for refresh yet');
  });

  test('security edge cases', async () => {
    // Test missing required fields
    const invalidPayload = { userId: 'test' };
    await expect(generateToken(invalidPayload)).rejects.toThrow('Missing required payload fields');
    
    // Test invalid signature
    const tamperedToken = (await generateToken(TEST_USER_PAYLOAD)).slice(0, -5) + 'xxxxx';
    await expect(verifyToken(tamperedToken)).rejects.toThrow('Invalid token');
    
    // Test invalid issuer/audience
    const invalidIssuerToken = await generateToken({
      ...TEST_USER_PAYLOAD,
      issuer: 'invalid-issuer'
    });
    await expect(verifyToken(invalidIssuerToken)).rejects.toThrow('Invalid token claims');
    
    // Test missing JWT keys
    jest.spyOn(authConfig, 'jwtPrivateKey', 'get').mockReturnValue('');
    await expect(generateToken(TEST_USER_PAYLOAD)).rejects.toThrow('JWT private key is not configured');
    
    // Test token version validation
    const invalidVersionToken = await generateToken({
      ...TEST_USER_PAYLOAD,
      version: 999
    });
    await expect(validateTokenVersion(invalidVersionToken)).rejects.toThrow('Invalid token version');
    
    // Test audit logging for security events
    await expect(verifyToken(tamperedToken)).rejects.toThrow();
    expect(mockAuditLog).toHaveBeenCalledWith({
      action: 'token_verification_failed',
      error: 'Invalid token',
      timestamp: expect.any(Number)
    });
  });
});