/**
 * @fileoverview Utility functions for formatting and transforming detection content
 * with syntax highlighting and display formatting across different detection formats.
 * @version 1.0.0
 */

// External imports
import highlight from 'highlight.js'; // v11.8.0
import dayjs from 'dayjs'; // v1.11.9
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Internal imports
import { DetectionFormat } from '../interfaces/detection';
import { DETECTION_FORMATS } from '../config/constants';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Cache for highlighted content to improve performance
const highlightCache = new Map<string, string>();

/**
 * Error messages for format utilities
 */
const ERROR_MESSAGES = {
  INVALID_CONTENT: 'Invalid detection content provided',
  INVALID_FORMAT: 'Unsupported detection format',
  INVALID_SCORE: 'Invalid confidence score',
  INVALID_DATE: 'Invalid date provided',
  HIGHLIGHT_ERROR: 'Error highlighting detection content',
} as const;

/**
 * Formats detection content with syntax highlighting based on the detection format.
 * Implements caching for performance optimization.
 * 
 * @param content - The detection rule content to format
 * @param format - The detection format (e.g., SPLUNK, SIGMA)
 * @returns HTML-formatted string with syntax highlighting or error message
 * @throws Error if content or format is invalid
 */
export function formatDetectionContent(content: string, format: DetectionFormat): string {
  try {
    // Input validation
    if (!content?.trim()) {
      throw new Error(ERROR_MESSAGES.INVALID_CONTENT);
    }

    // Find format configuration
    const formatConfig = DETECTION_FORMATS.find(f => f.id === format.toLowerCase());
    if (!formatConfig) {
      throw new Error(ERROR_MESSAGES.INVALID_FORMAT);
    }

    // Generate cache key
    const cacheKey = `${format}:${content}`;
    
    // Check cache first
    const cachedResult = highlightCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Apply syntax highlighting
    const highlighted = highlight.highlight(content, {
      language: formatConfig.syntax,
      ignoreIllegals: true
    }).value;

    // Cache the result
    highlightCache.set(cacheKey, highlighted);
    
    return highlighted;
  } catch (error) {
    console.error('Error formatting detection content:', error);
    return `<pre class="error">${ERROR_MESSAGES.HIGHLIGHT_ERROR}: ${error.message}</pre>`;
  }
}

/**
 * Formats translation confidence score as a percentage with validation.
 * 
 * @param score - Confidence score between 0 and 1
 * @returns Formatted percentage string
 * @throws Error if score is invalid
 */
export function formatConfidenceScore(score: number): string {
  try {
    // Validate score
    if (typeof score !== 'number' || isNaN(score) || score < 0 || score > 1) {
      throw new Error(ERROR_MESSAGES.INVALID_SCORE);
    }

    // Convert to percentage and format
    const percentage = (score * 100).toFixed(2);
    return `${percentage}%`;
  } catch (error) {
    console.error('Error formatting confidence score:', error);
    return 'N/A';
  }
}

/**
 * Formats date and time values with timezone support.
 * 
 * @param date - Date to format
 * @param format - Output format string (defaults to ISO)
 * @param timezone - Target timezone (defaults to UTC)
 * @returns Formatted date/time string
 * @throws Error if date is invalid
 */
export function formatDateTime(
  date: Date,
  format: string = 'YYYY-MM-DD HH:mm:ss',
  timezone: string = 'UTC'
): string {
  try {
    // Validate date
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    // Format date with timezone
    return dayjs(date)
      .tz(timezone)
      .format(format);
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return 'Invalid Date';
  }
}

/**
 * Gets the file extension for a given detection format.
 * 
 * @param format - Detection format
 * @returns File extension including dot
 * @throws Error if format is invalid
 */
export function getFormatExtension(format: DetectionFormat): string {
  const formatConfig = DETECTION_FORMATS.find(f => f.id === format.toLowerCase());
  if (!formatConfig) {
    throw new Error(ERROR_MESSAGES.INVALID_FORMAT);
  }
  return formatConfig.extension;
}

/**
 * Gets the syntax highlighting language for a given detection format.
 * 
 * @param format - Detection format
 * @returns Syntax highlighting language identifier
 * @throws Error if format is invalid
 */
export function getFormatSyntax(format: DetectionFormat): string {
  const formatConfig = DETECTION_FORMATS.find(f => f.id === format.toLowerCase());
  if (!formatConfig) {
    throw new Error(ERROR_MESSAGES.INVALID_FORMAT);
  }
  return formatConfig.syntax;
}

// Clear highlight cache when it grows too large
const MAX_CACHE_SIZE = 1000;
export function clearHighlightCache(): void {
  if (highlightCache.size > MAX_CACHE_SIZE) {
    highlightCache.clear();
  }
}