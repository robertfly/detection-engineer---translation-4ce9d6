// @mui/material version: 5.14.0
// @mui/material/styles version: 5.14.0
import { createTheme, ThemeProvider, ThemeOptions, PaletteMode } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BREAKPOINTS,
  SHADOWS,
  TRANSITIONS
} from './variables';

// Base theme configuration with accessibility enhancements
const baseTheme: Partial<ThemeOptions> = {
  typography: {
    fontFamily: TYPOGRAPHY.fontFamily,
    // Ensure minimum font sizes for readability
    fontSize: 16,
    htmlFontSize: 16,
    h1: {
      fontSize: TYPOGRAPHY.fontSizes['4xl'],
      fontWeight: TYPOGRAPHY.fontWeights.bold,
      lineHeight: TYPOGRAPHY.lineHeights.tight,
      '@media (max-width: 600px)': {
        fontSize: TYPOGRAPHY.fontSizes['3xl']
      }
    },
    h2: {
      fontSize: TYPOGRAPHY.fontSizes['3xl'],
      fontWeight: TYPOGRAPHY.fontWeights.bold,
      lineHeight: TYPOGRAPHY.lineHeights.tight,
      '@media (max-width: 600px)': {
        fontSize: TYPOGRAPHY.fontSizes['2xl']
      }
    },
    body1: {
      fontSize: TYPOGRAPHY.fontSizes.base,
      lineHeight: TYPOGRAPHY.lineHeights.base,
      '@media (max-width: 600px)': {
        fontSize: TYPOGRAPHY.fontSizes.sm
      }
    }
  },
  breakpoints: {
    values: BREAKPOINTS.values
  },
  spacing: SPACING.unit,
  shape: {
    borderRadius: 4
  }
};

// Enhanced component style overrides with accessibility improvements
const componentOverrides = {
  MuiButton: {
    styleOverrides: {
      root: {
        fontWeight: TYPOGRAPHY.fontWeights.medium,
        borderRadius: '4px',
        padding: `${SPACING.sizes.sm} ${SPACING.sizes.lg}`,
        '&:focus-visible': {
          outline: `3px solid ${COLORS.primary.main}`,
          outlineOffset: '2px'
        }
      },
      contained: {
        boxShadow: SHADOWS.elevation[2],
        '&:hover': {
          boxShadow: SHADOWS.elevation[3]
        }
      }
    }
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: '2px',
            borderColor: COLORS.primary.main
          }
        }
      }
    }
  },
  MuiLink: {
    styleOverrides: {
      root: {
        textDecorationThickness: '1px',
        textUnderlineOffset: '2px',
        '&:focus-visible': {
          outline: `3px solid ${COLORS.primary.main}`,
          outlineOffset: '2px'
        }
      }
    }
  }
};

// Create light theme with accessibility enhancements
export const createLightTheme = (highContrast: boolean = false): ThemeOptions => {
  const lightPalette = {
    mode: 'light' as PaletteMode,
    primary: {
      main: highContrast ? COLORS.highContrast.primary : COLORS.primary.main,
      light: COLORS.primary.light,
      dark: COLORS.primary.dark,
      contrastText: COLORS.primary.contrastText
    },
    secondary: {
      main: highContrast ? COLORS.highContrast.secondary : COLORS.secondary.main,
      light: COLORS.secondary.light,
      dark: COLORS.secondary.dark,
      contrastText: COLORS.secondary.contrastText
    },
    error: COLORS.error,
    warning: COLORS.warning,
    success: COLORS.success,
    background: {
      default: highContrast ? COLORS.highContrast.background : '#FFFFFF',
      paper: highContrast ? COLORS.highContrast.background : '#FFFFFF'
    },
    text: {
      primary: highContrast ? COLORS.highContrast.text : 'rgba(0, 0, 0, 0.87)',
      secondary: highContrast ? COLORS.highContrast.text : 'rgba(0, 0, 0, 0.60)'
    }
  };

  return {
    ...baseTheme,
    palette: lightPalette,
    components: componentOverrides
  };
};

// Create dark theme with accessibility enhancements
export const createDarkTheme = (highContrast: boolean = false): ThemeOptions => {
  const darkPalette = {
    mode: 'dark' as PaletteMode,
    primary: {
      main: COLORS.darkMode.primary,
      light: alpha(COLORS.darkMode.primary, 0.8),
      dark: alpha(COLORS.darkMode.primary, 1),
      contrastText: COLORS.darkMode.text.primary
    },
    secondary: {
      main: COLORS.darkMode.secondary,
      light: alpha(COLORS.darkMode.secondary, 0.8),
      dark: alpha(COLORS.darkMode.secondary, 1),
      contrastText: COLORS.darkMode.text.primary
    },
    background: {
      default: highContrast ? '#000000' : COLORS.darkMode.background,
      paper: highContrast ? '#000000' : COLORS.darkMode.surface
    },
    text: {
      primary: highContrast ? '#FFFFFF' : COLORS.darkMode.text.primary,
      secondary: highContrast ? '#FFFFFF' : COLORS.darkMode.text.secondary
    }
  };

  return {
    ...baseTheme,
    palette: darkPalette,
    components: {
      ...componentOverrides,
      MuiButton: {
        ...componentOverrides.MuiButton,
        styleOverrides: {
          ...componentOverrides.MuiButton.styleOverrides,
          root: {
            ...componentOverrides.MuiButton.styleOverrides.root,
            '&:focus-visible': {
              outline: `3px solid ${COLORS.darkMode.primary}`,
              outlineOffset: '2px'
            }
          }
        }
      }
    }
  };
};

// Theme selection utility with accessibility preferences
export const getThemeByMode = (
  mode: PaletteMode,
  highContrast: boolean = false,
  reducedMotion: boolean = false
) => {
  const themeOptions = mode === 'light' 
    ? createLightTheme(highContrast)
    : createDarkTheme(highContrast);

  // Apply reduced motion preferences
  if (reducedMotion) {
    themeOptions.transitions = {
      duration: TRANSITIONS.reducedMotion.duration,
      easing: TRANSITIONS.easing
    };
  } else {
    themeOptions.transitions = {
      duration: TRANSITIONS.duration,
      easing: TRANSITIONS.easing
    };
  }

  return createTheme(themeOptions);
};

// Pre-configured themes for common use cases
export const lightTheme = getThemeByMode('light', false, false);
export const darkTheme = getThemeByMode('dark', false, false);
export const highContrastLightTheme = getThemeByMode('light', true, false);
export const highContrastDarkTheme = getThemeByMode('dark', true, false);