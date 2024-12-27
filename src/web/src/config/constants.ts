// @mui/material version: 5.14.0
import { ThemeMode } from '@mui/material';

/**
 * Type-safe interface for application configuration
 */
interface AppConfig {
  readonly APP_NAME: string;
  readonly APP_VERSION: string;
  readonly API_VERSION: string;
  readonly DEFAULT_LOCALE: string;
  readonly MIN_PASSWORD_LENGTH: number;
  readonly SESSION_TIMEOUT: number;
}

/**
 * Type-safe interface for detection format configuration
 */
interface DetectionFormat {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly syntax: string;
}

/**
 * Core application configuration constants
 */
export const APP_CONFIG: Readonly<AppConfig> = {
  APP_NAME: 'Detection Translation Platform',
  APP_VERSION: '1.0.0',
  API_VERSION: 'v1',
  DEFAULT_LOCALE: 'en',
  MIN_PASSWORD_LENGTH: 12,
  SESSION_TIMEOUT: 3600, // 1 hour in seconds
} as const;

/**
 * UI constants implementing Material Design 3.0 specifications
 */
export const UI_CONSTANTS = {
  BREAKPOINTS: {
    MOBILE: { min: 320, max: 767 },
    TABLET: { min: 768, max: 1023 },
    DESKTOP: { min: 1024, max: 1439 },
    LARGE: { min: 1440, max: undefined },
  },
  SPACING: {
    UNIT: 8, // Base spacing unit in pixels
    SMALL: 8,
    MEDIUM: 16,
    LARGE: 24,
    XLARGE: 32,
  },
  TRANSITIONS: {
    DURATION: 300, // Duration in milliseconds
    EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  LAYOUT: {
    DRAWER_WIDTH: 240,
    HEADER_HEIGHT: 64,
    FOOTER_HEIGHT: 48,
    CONTENT_MAX_WIDTH: 1200,
  },
  THEME: {
    ELEVATION_LEVELS: [0, 1, 2, 3, 4, 8, 16, 24],
    BORDER_RADIUS: {
      SMALL: 4,
      MEDIUM: 8,
      LARGE: 16,
    },
  },
} as const;

/**
 * Supported detection formats configuration
 */
export const DETECTION_FORMATS: ReadonlyArray<DetectionFormat> = [
  {
    id: 'spl',
    name: 'Splunk SPL',
    extension: '.spl',
    syntax: 'spl',
  },
  {
    id: 'sigma',
    name: 'SIGMA',
    extension: '.yml',
    syntax: 'yaml',
  },
  {
    id: 'qradar',
    name: 'QRadar AQL',
    extension: '.aql',
    syntax: 'sql',
  },
  {
    id: 'kql',
    name: 'Azure KQL',
    extension: '.kql',
    syntax: 'kql',
  },
  {
    id: 'palo-alto',
    name: 'Palo Alto',
    extension: '.xml',
    syntax: 'xml',
  },
  {
    id: 'crowdstrike',
    name: 'Crowdstrike',
    extension: '.json',
    syntax: 'json',
  },
  {
    id: 'yara',
    name: 'YARA',
    extension: '.yar',
    syntax: 'yara',
  },
  {
    id: 'yara-l',
    name: 'YARA-L',
    extension: '.yaral',
    syntax: 'yara',
  },
] as const;

/**
 * API request rate limiting configuration
 */
export const API_REQUEST_LIMITS = {
  SINGLE_TRANSLATION: {
    REQUESTS_PER_MINUTE: 100,
    BURST_LIMIT: 120,
  },
  BATCH_TRANSLATION: {
    REQUESTS_PER_MINUTE: 10,
    BURST_LIMIT: 15,
    MAX_BATCH_SIZE: 100,
  },
  GITHUB_OPERATIONS: {
    REQUESTS_PER_HOUR: 30,
    BURST_LIMIT: 35,
  },
  VALIDATION: {
    REQUESTS_PER_MINUTE: 200,
    BURST_LIMIT: 250,
  },
} as const;