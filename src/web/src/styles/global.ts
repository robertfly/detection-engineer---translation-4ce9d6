// styled-components version: 5.3.0
import { createGlobalStyle, css } from 'styled-components';
import {
  TYPOGRAPHY,
  COLORS,
  BREAKPOINTS,
  TRANSITIONS,
  SPACING
} from './variables';

// Enhanced CSS reset with accessibility considerations
const resetStyles = css`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Improve text rendering */
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-size-adjust: 100%;
    /* Prevent font scaling in landscape while allowing user zoom */
    -webkit-text-size-adjust: 100%;
  }

  /* Set core body defaults with enhanced accessibility */
  body {
    min-height: 100vh;
    scroll-behavior: smooth;
    text-rendering: optimizeSpeed;
    line-height: ${TYPOGRAPHY.lineHeights.base};
    font-family: ${TYPOGRAPHY.fontFamily};
    font-size: ${TYPOGRAPHY.fontSizes.base};
    /* Ensure sufficient color contrast */
    color: ${COLORS.grey[900]};
    background-color: ${COLORS.grey[50]};

    /* High contrast mode support */
    @media (forced-colors: active) {
      color: CanvasText;
      background-color: Canvas;
    }
  }

  /* Enhanced focus styles for better accessibility */
  :focus-visible {
    outline: 3px solid ${COLORS.primary.main};
    outline-offset: 2px;
  }

  /* Remove list styles on ul, ol elements */
  ul, ol {
    list-style: none;
  }

  /* Enhanced link accessibility */
  a {
    color: ${COLORS.primary.main};
    text-decoration-thickness: 1px;
    text-underline-offset: 0.2em;
    
    &:hover {
      color: ${COLORS.primary.states.hover};
    }

    &:focus-visible {
      outline: 3px solid ${COLORS.primary.main};
      outline-offset: 2px;
    }
  }

  /* Improve media defaults */
  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
  }

  /* Remove built-in form typography styles */
  input, button, textarea, select {
    font: inherit;
  }
`;

// Enhanced base styles with fluid typography
const baseStyles = css`
  html {
    /* Fluid typography calculation */
    @media screen and (min-width: ${TYPOGRAPHY.fluidScaling.minScreen}) {
      font-size: calc(16px + (18 - 16) * ((100vw - ${TYPOGRAPHY.fluidScaling.minScreen}) / (${TYPOGRAPHY.fluidScaling.maxScreen} - ${TYPOGRAPHY.fluidScaling.minScreen})));
    }

    @media screen and (min-width: ${TYPOGRAPHY.fluidScaling.maxScreen}) {
      font-size: 18px;
    }
  }

  /* Enhanced touch targets for better accessibility */
  button, 
  [role="button"],
  input[type="submit"],
  input[type="reset"],
  input[type="button"] {
    min-height: 44px;
    min-width: 44px;
    padding: ${SPACING.sizes.sm} ${SPACING.sizes.md};
  }

  /* Improved spacing for text content */
  p, h1, h2, h3, h4, h5, h6 {
    overflow-wrap: break-word;
    margin-bottom: ${SPACING.sizes.md};
  }
`;

// Comprehensive accessibility styles
const accessibilityStyles = css`
  /* Screen reader only utility class */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Skip to main content link */
  .skip-to-content {
    position: absolute;
    top: -40px;
    left: 0;
    background: ${COLORS.primary.main};
    color: ${COLORS.primary.contrastText};
    padding: ${SPACING.sizes.sm};
    z-index: 100;

    &:focus {
      top: 0;
    }
  }

  /* Enhanced keyboard navigation indicators */
  body:not(.user-is-tabbing) button:focus,
  body:not(.user-is-tabbing) input:focus,
  body:not(.user-is-tabbing) select:focus,
  body:not(.user-is-tabbing) textarea:focus {
    outline: none;
  }
`;

// Enhanced theme-aware styles
const themeStyles = css`
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    body {
      color: ${COLORS.darkMode.text.primary};
      background-color: ${COLORS.darkMode.background};
    }

    a {
      color: ${COLORS.darkMode.primary};
    }
  }

  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* High contrast mode adjustments */
  @media (forced-colors: active) {
    * {
      border-color: ButtonText;
    }
  }
`;

// Export enhanced GlobalStyles component
export const GlobalStyles = createGlobalStyle`
  ${resetStyles}
  ${baseStyles}
  ${accessibilityStyles}
  ${themeStyles}

  /* Responsive breakpoint utilities */
  ${Object.entries(BREAKPOINTS.mediaQueries.up).map(
    ([key, query]) => css`
      ${query} {
        .show-${key} {
          display: block;
        }
        .hide-${key} {
          display: none;
        }
      }
    `
  )}

  /* Print styles */
  @media print {
    body {
      color: #000;
      background: #fff;
    }

    a {
      text-decoration: underline;
    }

    .no-print {
      display: none;
    }
  }
`;

export default GlobalStyles;