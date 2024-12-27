// @mui/material version: 5.14.0
import { createTheme, ThemeProvider, ThemeOptions, PaletteMode } from '@mui/material';
import { useMediaQuery } from '@mui/material';
import { COLORS, TYPOGRAPHY, SPACING, BREAKPOINTS, SHADOWS, TRANSITIONS } from '../styles/variables';
import { UI_CONSTANTS } from './constants';

/**
 * Interface for theme preferences including accessibility options
 */
interface ThemePreferences {
  mode: PaletteMode;
  highContrast: boolean;
  reducedMotion: boolean;
}

/**
 * Hook to detect system theme and accessibility preferences
 */
export const useSystemTheme = (): ThemePreferences => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: more)');

  return {
    mode: prefersDarkMode ? 'dark' : 'light',
    highContrast: prefersHighContrast,
    reducedMotion: prefersReducedMotion,
  };
};

/**
 * Enhanced component overrides with accessibility improvements
 */
const getComponentOverrides = (mode: PaletteMode, highContrast: boolean) => ({
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: UI_CONSTANTS.THEME.BORDER_RADIUS.MEDIUM,
        fontWeight: TYPOGRAPHY.fontWeights.medium,
        '&:focus-visible': {
          outline: `3px solid ${highContrast ? COLORS.highContrast.primary : COLORS.primary.main}`,
          outlineOffset: 2,
        },
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
            borderColor: highContrast ? COLORS.highContrast.primary : COLORS.primary.main,
          },
        },
      },
    },
  },
  MuiFocusRing: {
    defaultProps: {
      thickness: 3,
    },
  },
});

/**
 * Creates a customized Material UI theme with enhanced accessibility features
 */
export const createAppTheme = (mode: PaletteMode, highContrast: boolean = false) => {
  const baseTheme: ThemeOptions = {
    palette: {
      mode,
      primary: {
        ...COLORS.primary,
        main: highContrast ? COLORS.highContrast.primary : COLORS.primary.main,
      },
      secondary: {
        ...COLORS.secondary,
        main: highContrast ? COLORS.highContrast.secondary : COLORS.secondary.main,
      },
      background: {
        default: mode === 'dark' ? COLORS.darkMode.background : COLORS.highContrast.background,
        paper: mode === 'dark' ? COLORS.darkMode.surface : '#FFFFFF',
      },
      text: {
        primary: mode === 'dark' ? COLORS.darkMode.text.primary : COLORS.highContrast.text,
        secondary: mode === 'dark' ? COLORS.darkMode.text.secondary : 'rgba(0, 0, 0, 0.7)',
      },
      error: COLORS.error,
      warning: COLORS.warning,
      success: COLORS.success,
      grey: COLORS.grey,
    },
    typography: {
      fontFamily: TYPOGRAPHY.fontFamily,
      fontWeightLight: TYPOGRAPHY.fontWeights.light,
      fontWeightRegular: TYPOGRAPHY.fontWeights.regular,
      fontWeightMedium: TYPOGRAPHY.fontWeights.medium,
      fontWeightBold: TYPOGRAPHY.fontWeights.bold,
      h1: {
        fontSize: TYPOGRAPHY.fontSizes['4xl'],
        lineHeight: TYPOGRAPHY.lineHeights.tight,
        fontWeight: TYPOGRAPHY.fontWeights.bold,
      },
      h2: {
        fontSize: TYPOGRAPHY.fontSizes['3xl'],
        lineHeight: TYPOGRAPHY.lineHeights.tight,
        fontWeight: TYPOGRAPHY.fontWeights.bold,
      },
      h3: {
        fontSize: TYPOGRAPHY.fontSizes['2xl'],
        lineHeight: TYPOGRAPHY.lineHeights.tight,
        fontWeight: TYPOGRAPHY.fontWeights.semibold,
      },
      h4: {
        fontSize: TYPOGRAPHY.fontSizes.xl,
        lineHeight: TYPOGRAPHY.lineHeights.base,
        fontWeight: TYPOGRAPHY.fontWeights.semibold,
      },
      h5: {
        fontSize: TYPOGRAPHY.fontSizes.lg,
        lineHeight: TYPOGRAPHY.lineHeights.base,
        fontWeight: TYPOGRAPHY.fontWeights.medium,
      },
      h6: {
        fontSize: TYPOGRAPHY.fontSizes.base,
        lineHeight: TYPOGRAPHY.lineHeights.base,
        fontWeight: TYPOGRAPHY.fontWeights.medium,
      },
      body1: {
        fontSize: TYPOGRAPHY.fontSizes.base,
        lineHeight: TYPOGRAPHY.lineHeights.relaxed,
      },
      body2: {
        fontSize: TYPOGRAPHY.fontSizes.sm,
        lineHeight: TYPOGRAPHY.lineHeights.relaxed,
      },
    },
    spacing: SPACING.unit,
    breakpoints: {
      values: BREAKPOINTS.values,
    },
    shadows: mode === 'dark' ? SHADOWS.dark : SHADOWS.light,
    shape: {
      borderRadius: UI_CONSTANTS.THEME.BORDER_RADIUS.MEDIUM,
    },
    transitions: {
      duration: {
        shortest: TRANSITIONS.duration.shortest,
        shorter: TRANSITIONS.duration.shorter,
        short: TRANSITIONS.duration.short,
        standard: TRANSITIONS.duration.standard,
        complex: TRANSITIONS.duration.complex,
        enteringScreen: TRANSITIONS.duration.enteringScreen,
        leavingScreen: TRANSITIONS.duration.leavingScreen,
      },
      easing: TRANSITIONS.easing,
    },
    components: getComponentOverrides(mode, highContrast),
  };

  return createTheme(baseTheme);
};

// Pre-configured theme instances
export const lightTheme = createAppTheme('light', false);
export const darkTheme = createAppTheme('dark', false);

// Export theme utilities
export const theme = {
  lightTheme,
  darkTheme,
  createAppTheme,
  useSystemTheme,
};

export default theme;