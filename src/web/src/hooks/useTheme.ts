// @mui/material version: 5.14.0
// react version: 18.2.0
import { useState, useEffect, useCallback } from 'react';
import { PaletteMode } from '@mui/material';
import { createAppTheme, useSystemTheme } from '../config/theme';
import { getThemeByMode } from '../styles/theme';

// Storage keys for persisting preferences
const THEME_STORAGE_KEY = 'theme-mode';
const HIGH_CONTRAST_STORAGE_KEY = 'high-contrast-mode';
const REDUCED_MOTION_STORAGE_KEY = 'reduced-motion';

/**
 * Custom hook for managing application theme state and accessibility preferences
 * Implements theme switching, high contrast mode, and reduced motion preferences
 * with system preference detection and local storage persistence
 */
export const useTheme = () => {
  // Initialize theme mode from storage or system preference
  const systemPreferences = useSystemTheme();
  const [mode, setMode] = useState<PaletteMode>(() => {
    const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
    return (savedMode as PaletteMode) || systemPreferences.mode;
  });

  // Initialize high contrast mode from storage or system preference
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    const savedPreference = localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY);
    return savedPreference ? JSON.parse(savedPreference) : systemPreferences.highContrast;
  });

  // Initialize reduced motion preference from storage or system preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    const savedPreference = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    return savedPreference ? JSON.parse(savedPreference) : systemPreferences.reducedMotion;
  });

  // Create memoized theme object based on current preferences
  const theme = useCallback(() => {
    return getThemeByMode(mode, isHighContrast, prefersReducedMotion);
  }, [mode, isHighContrast, prefersReducedMotion]);

  // Toggle theme mode with storage persistence
  const toggleTheme = useCallback(() => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  // Toggle high contrast mode with storage persistence
  const toggleHighContrast = useCallback(() => {
    setIsHighContrast((prevState) => {
      const newState = !prevState;
      localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Effect for syncing with system theme preference changes
  useEffect(() => {
    const handleSystemThemeChange = () => {
      // Only update if no user preference is stored
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setMode(systemPreferences.mode);
      }
    };

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addListener(handleSystemThemeChange);

    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeListener(handleSystemThemeChange);
    };
  }, [systemPreferences.mode]);

  // Effect for handling reduced motion preference changes
  useEffect(() => {
    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, JSON.stringify(event.matches));
    };

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addListener(handleReducedMotionChange as any);

    return () => {
      mediaQuery.removeListener(handleReducedMotionChange as any);
    };
  }, []);

  return {
    theme: theme(),
    mode,
    isHighContrast,
    prefersReducedMotion,
    toggleTheme,
    toggleHighContrast
  };
};

export type UseThemeReturn = ReturnType<typeof useTheme>;