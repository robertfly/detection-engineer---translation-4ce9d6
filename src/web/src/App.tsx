/**
 * Root application component implementing Material Design 3.0 with enhanced security,
 * accessibility (WCAG 2.1 Level AA), and performance monitoring features.
 * @version 1.0.0
 */

// External imports - version controlled
import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Auth0Provider } from '@auth0/auth0-react';

// Internal imports
import Layout from './components/common/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import routes from './config/routes';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

// Auth0 configuration with enhanced security
const AUTH0_CONFIG = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
  redirectUri: window.location.origin,
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  scope: 'openid profile email',
  mfa: {
    enabled: true,
    universalLoginScreenConfig: {
      mfaOption: 'push'
    }
  }
};

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  enableMonitoring: true,
  sampleRate: 0.1,
  reportingEndpoint: process.env.REACT_APP_PERFORMANCE_ENDPOINT
};

/**
 * Enhanced App component with security, accessibility, and performance features
 */
const App: React.FC = () => {
  const { theme, isHighContrast, prefersReducedMotion } = useTheme();
  const { validateSession } = useAuth();

  // Initialize performance monitoring
  useEffect(() => {
    if (PERFORMANCE_CONFIG.enableMonitoring) {
      metrics.initializeMetrics({
        environment: process.env.NODE_ENV,
        datadogClientToken: process.env.REACT_APP_DATADOG_CLIENT_TOKEN || '',
        datadogApplicationId: process.env.REACT_APP_DATADOG_APP_ID || '',
        enableRUM: true,
        enableWebVitals: true,
        sampleRate: PERFORMANCE_CONFIG.sampleRate,
        securityMode: {
          enableAuditTrail: true,
          encryptSensitiveData: true,
          sensitiveFields: ['accessToken', 'password'],
          retentionDays: 30
        },
        customTags: {
          app: 'detection-translator',
          version: '1.0.0'
        },
        enablePIIProtection: true,
        bufferConfig: {
          maxSize: 100,
          flushInterval: 5000,
          enableCompression: true
        }
      });
    }
  }, []);

  // Handle session validation
  const handleSessionValidation = useCallback(async () => {
    try {
      const isValid = await validateSession();
      if (!isValid) {
        logger.warn('Invalid session detected');
        window.location.href = '/login';
      }
    } catch (error) {
      logger.error('Session validation failed', { error });
    }
  }, [validateSession]);

  // Validate session on mount and setup interval check
  useEffect(() => {
    handleSessionValidation();
    const interval = setInterval(handleSessionValidation, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [handleSessionValidation]);

  // Skip to main content for accessibility
  const handleSkipToContent = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.focus();
        mainContent.scrollIntoView();
      }
    }
  }, []);

  return (
    <Auth0Provider {...AUTH0_CONFIG}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        
        {/* Skip to main content link for accessibility */}
        <button
          onClick={handleSkipToContent}
          onKeyPress={handleSkipToContent}
          style={{
            position: 'absolute',
            left: '-9999px',
            zIndex: 999,
            padding: '1rem',
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            textDecoration: 'none',
            ':focus': {
              left: 0,
              outline: `3px solid ${theme.palette.primary.main}`
            }
          }}
        >
          Skip to main content
        </button>

        <BrowserRouter>
          <Layout>
            <Routes>
              {routes.map((route) => {
                const RouteComponent = route.protected ? (
                  <ProtectedRoute
                    requiredRoles={['ADMIN', 'ENGINEER', 'ANALYST']}
                    requireMFA={true}
                  >
                    {route.element}
                  </ProtectedRoute>
                ) : (
                  route.element
                );

                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={RouteComponent}
                  />
                );
              })}
            </Routes>
          </Layout>
        </BrowserRouter>
      </ThemeProvider>
    </Auth0Provider>
  );
};

export default App;