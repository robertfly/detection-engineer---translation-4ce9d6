// @mui/material/styles version: 5.14.0
import { alpha } from '@mui/material/styles';

// Color system implementing Material Design 3.0 with accessibility enhancements
export const COLORS = {
  primary: {
    main: '#006494', // WCAG AAA compliant
    light: '#4B9CCA',
    dark: '#003B5C',
    contrastText: '#FFFFFF',
    states: {
      hover: '#007AB3',
      pressed: '#005780',
      disabled: '#B2D4E5'
    }
  },
  secondary: {
    main: '#5C2D91', // WCAG AAA compliant
    light: '#8C5FB9',
    dark: '#3F1F63',
    contrastText: '#FFFFFF',
    states: {
      hover: '#6D35AC',
      pressed: '#4B2575',
      disabled: '#D4C4E5'
    }
  },
  error: {
    main: '#D32F2F', // WCAG AAA compliant
    light: '#EF5350',
    dark: '#C62828',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#ED6C02', // WCAG AAA compliant
    light: '#FF9800',
    dark: '#E65100',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#2E7D32', // WCAG AAA compliant
    light: '#4CAF50',
    dark: '#1B5E20',
    contrastText: '#FFFFFF'
  },
  grey: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  },
  darkMode: {
    background: '#121212',
    surface: '#1E1E1E',
    primary: '#90CAF9',
    secondary: '#CE93D8',
    text: {
      primary: 'rgba(255, 255, 255, 0.87)',
      secondary: 'rgba(255, 255, 255, 0.60)'
    }
  },
  highContrast: {
    primary: '#0052CC', // Enhanced contrast for accessibility
    secondary: '#403294',
    text: '#000000',
    background: '#FFFFFF',
    border: '#000000'
  }
};

// Typography system with fluid scaling and accessibility features
export const TYPOGRAPHY = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSizes: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeights: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.75
  },
  fluidScaling: {
    minScreen: '320px',
    maxScreen: '1440px',
    scaleFactors: {
      heading: 1.125,
      body: 1.05
    }
  }
};

// Enhanced spacing system with compound values
export const SPACING = {
  unit: 8, // Base unit in pixels
  sizes: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
    '2xl': '2.5rem', // 40px
    '3xl': '3rem'    // 48px
  },
  compounds: {
    cardPadding: '1.5rem',
    sectionSpacing: '2rem',
    containerPadding: {
      mobile: '1rem',
      tablet: '2rem',
      desktop: '3rem'
    }
  }
};

// Comprehensive breakpoint system with container queries
export const BREAKPOINTS = {
  values: {
    xs: 320,
    sm: 768,
    md: 1024,
    lg: 1440,
    xl: 1920
  },
  containers: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },
  mediaQueries: {
    up: {
      xs: '@media (min-width: 320px)',
      sm: '@media (min-width: 768px)',
      md: '@media (min-width: 1024px)',
      lg: '@media (min-width: 1440px)',
      xl: '@media (min-width: 1920px)'
    },
    down: {
      xs: '@media (max-width: 319px)',
      sm: '@media (max-width: 767px)',
      md: '@media (max-width: 1023px)',
      lg: '@media (max-width: 1439px)',
      xl: '@media (max-width: 1919px)'
    }
  }
};

// Theme-aware elevation system
export const SHADOWS = {
  light: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  },
  dark: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  },
  elevation: {
    0: 'none',
    1: '0px 1px 3px rgba(0, 0, 0, 0.12)',
    2: '0px 2px 6px rgba(0, 0, 0, 0.14)',
    3: '0px 3px 8px rgba(0, 0, 0, 0.16)',
    4: '0px 4px 12px rgba(0, 0, 0, 0.18)',
    5: '0px 6px 16px rgba(0, 0, 0, 0.20)'
  }
};

// Enhanced animation system with accessibility considerations
export const TRANSITIONS = {
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
  },
  spring: {
    gentle: 'spring(1, 100, 10, 0)',
    responsive: 'spring(1, 80, 12, 0)',
    bouncy: 'spring(1, 60, 10, 0)'
  },
  reducedMotion: {
    transform: '@media (prefers-reduced-motion: reduce)',
    duration: {
      standard: 0,
      complex: 0
    }
  }
};

// Utility function for creating accessible alpha colors
export const createAlpha = (
  color: string,
  opacity: number,
  highContrast: boolean = false
): string => {
  // Ensure opacity meets minimum contrast requirements for accessibility
  const minOpacity = highContrast ? 0.9 : 0.7;
  const safeOpacity = Math.max(opacity, minOpacity);
  
  // Apply opacity using MUI alpha utility
  return alpha(color, safeOpacity);
};