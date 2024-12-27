/**
 * @fileoverview Font configuration and assets for the Detection Translation Platform
 * Implements Material Design 3.0 typography specifications with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

// @fontsource/inter v5.0.0 - Load Inter font family variants
import '@fontsource/inter/400.css'; // Regular
import '@fontsource/inter/500.css'; // Medium
import '@fontsource/inter/600.css'; // Semibold
import '@fontsource/inter/700.css'; // Bold

/**
 * Font weight definitions following Material Design 3.0 specifications
 * Used for consistent typography across the application
 * @see https://m3.material.io/styles/typography/type-scale-tokens
 */
export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Font family definitions with accessibility-focused fallback stack
 * Supports multiple scripts and platforms while maintaining WCAG 2.1 Level AA compliance
 * @see https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html
 */
export const FONT_FAMILY = {
  /**
   * Primary font family - Inter
   * A modern, highly legible sans-serif typeface designed for computer screens
   */
  primary: "'Inter'",

  /**
   * Fallback font stack
   * Provides system fonts across different platforms ensuring consistent readability
   * Includes emoji font support for better cross-platform compatibility
   */
  fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",
} as const;

/**
 * Type guard to check if a font weight value is valid
 * @param weight - The font weight value to check
 * @returns True if the weight is a valid Material Design font weight
 */
export const isValidFontWeight = (weight: number): weight is typeof FONT_WEIGHTS[keyof typeof FONT_WEIGHTS] => {
  return Object.values(FONT_WEIGHTS).includes(weight);
};

/**
 * Helper function to generate the complete font family string with fallbacks
 * @returns The complete font family string ready for CSS usage
 */
export const getCompleteFontFamily = (): string => {
  return `${FONT_FAMILY.primary}, ${FONT_FAMILY.fallback}`;
};