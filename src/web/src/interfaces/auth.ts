// @auth0/auth0-react version: ^2.0.0
import { Auth0User } from '@auth0/auth0-react';

/**
 * Enumeration of available user roles in the system
 * @enum {string}
 */
export enum UserRole {
    ADMIN = 'ADMIN',
    ENGINEER = 'ENGINEER',
    ANALYST = 'ANALYST',
    READER = 'READER'
}

/**
 * Enumeration of available permissions in the system
 * @enum {string}
 */
export enum Permission {
    CREATE = 'CREATE',
    READ = 'READ',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    TRANSLATE = 'TRANSLATE',
    MANAGE = 'MANAGE'
}

/**
 * Enumeration of supported authentication providers
 * @enum {string}
 */
export enum AuthProvider {
    AUTH0 = 'AUTH0',
    INTERNAL = 'INTERNAL',
    SSO = 'SSO'
}

/**
 * Enumeration of supported token types
 * @enum {string}
 */
export enum TokenType {
    Bearer = 'Bearer',
    JWT = 'JWT'
}

/**
 * Interface defining authentication error structure
 * @interface
 */
export interface AuthError {
    readonly code: string;
    readonly message: string;
    readonly details?: any;
}

/**
 * Interface defining MFA configuration options
 * @interface
 */
export interface MFAConfiguration {
    readonly enabled: boolean;
    readonly methods: string[];
    readonly timeoutSeconds: number;
}

/**
 * Interface for authenticated user data with enhanced security properties
 * Extends base Auth0 user profile with additional security-related fields
 * @interface
 */
export interface AuthUser {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly roles: ReadonlyArray<UserRole>;
    readonly permissions: ReadonlyArray<Permission>;
    readonly mfaEnabled: boolean;
    readonly lastLogin: Date;
}

/**
 * Interface for authentication state management with enhanced tracking
 * @interface
 */
export interface AuthState {
    readonly isAuthenticated: boolean;
    readonly isLoading: boolean;
    readonly user: AuthUser | null;
    readonly error: AuthError | null;
    readonly lastAuthenticated: Date | null;
    readonly authProvider: AuthProvider;
}

/**
 * Interface for authentication token data with immutability
 * @interface
 */
export interface AuthToken {
    readonly accessToken: string;
    readonly tokenType: TokenType;
    readonly expiresAt: number;
    readonly issuedAt: number;
    readonly refreshToken: string;
}

/**
 * Interface for Auth0 configuration settings with MFA support
 * @interface
 */
export interface AuthConfig {
    readonly domain: string;
    readonly clientId: string;
    readonly audience: string;
    readonly scope: string;
    readonly mfaConfig: MFAConfiguration;
}

// Type guards for runtime type checking

/**
 * Type guard to check if a value is a valid UserRole
 * @param value - Value to check
 */
export const isUserRole = (value: any): value is UserRole => {
    return Object.values(UserRole).includes(value);
};

/**
 * Type guard to check if a value is a valid Permission
 * @param value - Value to check
 */
export const isPermission = (value: any): value is Permission => {
    return Object.values(Permission).includes(value);
};

/**
 * Type guard to check if a value is a valid AuthToken
 * @param value - Value to check
 */
export const isAuthToken = (value: any): value is AuthToken => {
    return (
        typeof value === 'object' &&
        typeof value.accessToken === 'string' &&
        typeof value.expiresAt === 'number' &&
        typeof value.issuedAt === 'number' &&
        typeof value.refreshToken === 'string' &&
        Object.values(TokenType).includes(value.tokenType)
    );
};

/**
 * Type guard to check if a value is a valid AuthUser
 * @param value - Value to check
 */
export const isAuthUser = (value: any): value is AuthUser => {
    return (
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        typeof value.email === 'string' &&
        typeof value.name === 'string' &&
        Array.isArray(value.roles) &&
        value.roles.every(isUserRole) &&
        Array.isArray(value.permissions) &&
        value.permissions.every(isPermission) &&
        typeof value.mfaEnabled === 'boolean' &&
        value.lastLogin instanceof Date
    );
};