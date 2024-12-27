// crypto-js version: ^4.1.1
import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';
import { APP_CONFIG } from '../config/constants';
import { AuthToken } from '../interfaces/auth';

/**
 * Enumeration of supported storage types
 */
export enum StorageType {
  LOCAL = 'localStorage',
  SESSION = 'sessionStorage'
}

/**
 * Interface for storage operation options
 */
export interface StorageOptions {
  encrypt?: boolean;
  expiresIn?: number;
  compress?: boolean;
}

/**
 * Interface for stored data metadata
 */
interface StorageMetadata {
  version: string;
  timestamp: number;
  expiresAt?: number;
  encrypted: boolean;
  compressed: boolean;
}

/**
 * Interface for storage entry containing data and metadata
 */
interface StorageEntry<T> {
  data: T;
  metadata: StorageMetadata;
}

// Constants
const STORAGE_PREFIX = 'detection_translator_';
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || '';
const MAX_STORAGE_SIZE = 5242880; // 5MB

/**
 * Decorator for validating storage keys
 */
function validateStorageKey(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    const key = args[0];
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Invalid storage key');
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Class for managing browser storage operations with advanced features
 */
export class StorageManager {
  private readonly storageType: StorageType;
  private readonly defaultOptions: StorageOptions;
  private readonly storage: Storage;

  constructor(type: StorageType = StorageType.LOCAL, options: StorageOptions = {}) {
    this.storageType = type;
    this.defaultOptions = {
      encrypt: false,
      compress: false,
      expiresIn: APP_CONFIG.SESSION_TIMEOUT,
      ...options
    };
    this.storage = type === StorageType.LOCAL ? window.localStorage : window.sessionStorage;
    this.verifyStorageAvailability();
  }

  /**
   * Verifies storage availability and quota
   * @throws {Error} If storage is not available or quota is exceeded
   */
  private verifyStorageAvailability(): void {
    try {
      const testKey = `${STORAGE_PREFIX}test`;
      this.storage.setItem(testKey, '1');
      this.storage.removeItem(testKey);
    } catch (error) {
      throw new Error(`Storage ${this.storageType} is not available`);
    }
  }

  /**
   * Encrypts sensitive data using AES-256
   * @param data - Data to encrypt
   * @returns Encrypted data string
   */
  private encrypt(data: string): string {
    if (!ENCRYPTION_KEY) {
      throw new Error('Encryption key is not configured');
    }
    return AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypts encrypted data
   * @param encryptedData - Encrypted data string
   * @returns Decrypted data string
   */
  private decrypt(encryptedData: string): string {
    if (!ENCRYPTION_KEY) {
      throw new Error('Encryption key is not configured');
    }
    const bytes = AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(encUtf8);
  }

  /**
   * Compresses data using built-in compression
   * @param data - Data to compress
   * @returns Compressed data string
   */
  private compress(data: string): string {
    return btoa(encodeURIComponent(data));
  }

  /**
   * Decompresses compressed data
   * @param compressedData - Compressed data string
   * @returns Decompressed data string
   */
  private decompress(compressedData: string): string {
    return decodeURIComponent(atob(compressedData));
  }

  /**
   * Stores data with metadata
   * @param key - Storage key
   * @param value - Value to store
   * @param options - Storage options
   */
  @validateStorageKey
  public setItem<T>(key: string, value: T, options: StorageOptions = {}): void {
    const finalOptions = { ...this.defaultOptions, ...options };
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    const metadata: StorageMetadata = {
      version: APP_CONFIG.APP_VERSION,
      timestamp: Date.now(),
      encrypted: finalOptions.encrypt || false,
      compressed: finalOptions.compress || false
    };

    if (finalOptions.expiresIn) {
      metadata.expiresAt = Date.now() + (finalOptions.expiresIn * 1000);
    }

    let serializedData = JSON.stringify(value);
    
    if (finalOptions.compress) {
      serializedData = this.compress(serializedData);
    }
    
    if (finalOptions.encrypt) {
      serializedData = this.encrypt(serializedData);
    }

    const entry: StorageEntry<string> = {
      data: serializedData,
      metadata
    };

    const serializedEntry = JSON.stringify(entry);
    if (serializedEntry.length > MAX_STORAGE_SIZE) {
      throw new Error('Storage quota exceeded');
    }

    this.storage.setItem(prefixedKey, serializedEntry);
  }

  /**
   * Retrieves and processes stored data
   * @param key - Storage key
   * @param options - Storage options
   * @returns Retrieved value or null if not found
   */
  @validateStorageKey
  public getItem<T>(key: string, options: StorageOptions = {}): T | null {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const serializedEntry = this.storage.getItem(prefixedKey);

    if (!serializedEntry) {
      return null;
    }

    try {
      const entry: StorageEntry<string> = JSON.parse(serializedEntry);
      
      // Check expiration
      if (entry.metadata.expiresAt && entry.metadata.expiresAt < Date.now()) {
        this.removeItem(key);
        return null;
      }

      let data = entry.data;

      if (entry.metadata.encrypted) {
        data = this.decrypt(data);
      }

      if (entry.metadata.compressed) {
        data = this.decompress(data);
      }

      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Error retrieving storage item:', error);
      return null;
    }
  }

  /**
   * Removes item from storage
   * @param key - Storage key
   */
  @validateStorageKey
  public removeItem(key: string): void {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    this.storage.removeItem(prefixedKey);
  }

  /**
   * Clears all expired items from storage
   */
  public clearExpired(): void {
    const keys = Object.keys(this.storage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          const serializedEntry = this.storage.getItem(key);
          if (serializedEntry) {
            const entry: StorageEntry<string> = JSON.parse(serializedEntry);
            if (entry.metadata.expiresAt && entry.metadata.expiresAt < Date.now()) {
              this.storage.removeItem(key);
            }
          }
        } catch (error) {
          console.error('Error clearing expired item:', error);
        }
      }
    });
  }

  /**
   * Stores authentication token with encryption
   * @param token - Authentication token
   */
  public setAuthToken(token: AuthToken): void {
    this.setItem('auth_token', token, {
      encrypt: true,
      expiresIn: Math.floor((token.expiresAt - Date.now()) / 1000)
    });
  }

  /**
   * Retrieves stored authentication token
   * @returns Authentication token or null if not found
   */
  public getAuthToken(): AuthToken | null {
    return this.getItem<AuthToken>('auth_token', { encrypt: true });
  }
}

// Export singleton instances for common use cases
export const localStorageManager = new StorageManager(StorageType.LOCAL);
export const sessionStorageManager = new StorageManager(StorageType.SESSION);