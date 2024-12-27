// react version: 18.2.0
// @mui/material version: 5.14.0
// @mui/icons-material version: 5.14.0

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Snackbar,
  CircularProgress,
  Slider,
  useMediaQuery,
  styled,
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  AccessibilityNew,
  Contrast,
  TextFields,
} from '@mui/icons-material';
import Layout from '../components/common/Layout';
import { useTheme } from '../hooks/useTheme';
import { logger } from '../utils/logger';

// Styled components with accessibility enhancements
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.standard,
  }),
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover': {
      transform: 'none',
    },
  },
}));

const SettingsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
}));

// Settings sections configuration
const SETTINGS_SECTIONS = [
  {
    id: 'theme',
    title: 'Theme Settings',
    description: 'Customize the application appearance',
    icon: Brightness4,
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    description: 'Configure accessibility preferences',
    icon: AccessibilityNew,
  },
  {
    id: 'display',
    title: 'Display Settings',
    description: 'Adjust display preferences',
    icon: TextFields,
  },
] as const;

// Font size configuration
const FONT_SIZE_MARKS = [
  { value: 0.8, label: 'Small' },
  { value: 1, label: 'Medium' },
  { value: 1.2, label: 'Large' },
];

/**
 * Settings page component that provides user-configurable application settings
 * Implements Material Design 3.0 specifications with WCAG 2.1 Level AA compliance
 */
const Settings: React.FC = React.memo(() => {
  const {
    theme,
    mode,
    isHighContrast,
    prefersReducedMotion,
    toggleTheme,
    toggleHighContrast,
  } = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [fontSize, setFontSize] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string>('');

  // Save settings to local storage
  const saveSettings = useCallback(async (key: string, value: any) => {
    try {
      setIsLoading(true);
      localStorage.setItem(`settings_${key}`, JSON.stringify(value));
      setNotification('Settings saved successfully');
      logger.info('Settings updated', { key, value });
    } catch (error) {
      logger.error('Failed to save settings', { error });
      setNotification('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load saved settings on mount
  useEffect(() => {
    const loadSavedSettings = () => {
      try {
        const savedFontSize = localStorage.getItem('settings_fontSize');
        if (savedFontSize) {
          setFontSize(JSON.parse(savedFontSize));
        }
      } catch (error) {
        logger.error('Failed to load settings', { error });
      }
    };

    loadSavedSettings();
  }, []);

  // Handle font size change
  const handleFontSizeChange = useCallback((_: Event, value: number | number[]) => {
    const newSize = Array.isArray(value) ? value[0] : value;
    setFontSize(newSize);
    saveSettings('fontSize', newSize);
    document.documentElement.style.fontSize = `${newSize * 100}%`;
  }, [saveSettings]);

  return (
    <Layout>
      <Box
        component="main"
        role="main"
        aria-label="Settings page"
        sx={{ p: { xs: 2, sm: 3 } }}
      >
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          component="h1"
          gutterBottom
          sx={{ mb: 4 }}
        >
          Settings
        </Typography>

        {/* Theme Settings */}
        <StyledCard>
          <CardContent>
            <SettingsSection>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {mode === 'light' ? <Brightness7 /> : <Brightness4 />}
                <Box>
                  <Typography variant="h6">Theme Mode</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose between light and dark theme
                  </Typography>
                </Box>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={mode === 'dark'}
                    onChange={toggleTheme}
                    name="themeMode"
                    color="primary"
                    aria-label="Toggle theme mode"
                  />
                }
                label={mode === 'light' ? 'Light Mode' : 'Dark Mode'}
              />
            </SettingsSection>
          </CardContent>
        </StyledCard>

        {/* Accessibility Settings */}
        <StyledCard>
          <CardContent>
            <SettingsSection>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Contrast />
                <Box>
                  <Typography variant="h6">High Contrast</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Increase contrast for better visibility
                  </Typography>
                </Box>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={isHighContrast}
                    onChange={toggleHighContrast}
                    name="highContrast"
                    color="primary"
                    aria-label="Toggle high contrast mode"
                  />
                }
                label="High Contrast Mode"
              />
            </SettingsSection>

            <Divider sx={{ my: 2 }} />

            <SettingsSection>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AccessibilityNew />
                <Box>
                  <Typography variant="h6">Reduced Motion</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Minimize animations and transitions
                  </Typography>
                </Box>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={prefersReducedMotion}
                    onChange={() => {
                      saveSettings('reducedMotion', !prefersReducedMotion);
                    }}
                    name="reducedMotion"
                    color="primary"
                    aria-label="Toggle reduced motion"
                  />
                }
                label="Reduce Motion"
              />
            </SettingsSection>
          </CardContent>
        </StyledCard>

        {/* Display Settings */}
        <StyledCard>
          <CardContent>
            <SettingsSection>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextFields />
                <Box>
                  <Typography variant="h6">Font Size</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Adjust the text size
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ width: { xs: '100%', sm: '200px' } }}>
                <Slider
                  value={fontSize}
                  onChange={handleFontSizeChange}
                  aria-label="Font size"
                  min={0.8}
                  max={1.2}
                  step={0.1}
                  marks={FONT_SIZE_MARKS}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                />
              </Box>
            </SettingsSection>
          </CardContent>
        </StyledCard>

        {/* Loading Indicator */}
        {isLoading && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: theme.zIndex.snackbar + 1,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Notifications */}
        <Snackbar
          open={!!notification}
          autoHideDuration={3000}
          onClose={() => setNotification('')}
          message={notification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Layout>
  );
});

Settings.displayName = 'Settings';

export default Settings;