// @mui/material version: 5.14.0
// react version: 18.2.0
// react-router-dom version: 6.14.0
import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  useTheme,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { LoginForm } from '../components/auth/LoginForm';
import { Layout } from '../components/common/Layout';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { logger } from '../utils/logger';
import { UI_CONSTANTS } from '../config/constants';

/**
 * Enhanced Login page component implementing OAuth 2.0 with Auth0
 * Follows Material Design 3.0 and WCAG 2.1 Level AA accessibility standards
 */
const Login: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, validateSession } = useAuth();
  const [isValidating, setIsValidating] = useState(true);

  // Validate session and handle redirection
  useEffect(() => {
    const checkSession = async () => {
      try {
        const isValid = await validateSession();
        if (isValid) {
          logger.info('Valid session detected, redirecting to dashboard');
          navigate('/dashboard');
        }
      } catch (error) {
        logger.error('Session validation failed', { error });
      } finally {
        setIsValidating(false);
      }
    };

    checkSession();
  }, [validateSession, navigate]);

  // Enhanced login success handler with security logging
  const handleLoginSuccess = useCallback(async (user: any) => {
    try {
      logger.info('Login successful', { userId: user.id });
      
      // Validate session after login
      const isValid = await validateSession();
      if (!isValid) {
        throw new Error('Session validation failed after login');
      }

      navigate('/dashboard');
    } catch (error) {
      logger.error('Post-login validation failed', { error });
      handleLoginError(error);
    }
  }, [navigate, validateSession]);

  // Enhanced error handler with security monitoring
  const handleLoginError = useCallback((error: Error) => {
    logger.error('Login failed', {
      error,
      timestamp: new Date().toISOString(),
      correlationId: crypto.randomUUID()
    });
  }, []);

  // Show loading state while validating session
  if (isValidating) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default
        }}
      >
        <CircularProgress
          size={40}
          thickness={4}
          aria-label="Validating session"
        />
      </Box>
    );
  }

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/dashboard');
    return null;
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Container
          maxWidth="sm"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: `calc(100vh - ${UI_CONSTANTS.LAYOUT.HEADER_HEIGHT + UI_CONSTANTS.LAYOUT.FOOTER_HEIGHT}px)`,
            padding: theme.spacing(3),
            [theme.breakpoints.down('sm')]: {
              padding: theme.spacing(2),
            }
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: isMobile ? '100%' : '400px',
              marginTop: isMobile ? '-32px' : '-64px',
              position: 'relative',
              '& > *': {
                marginBottom: theme.spacing(2)
              }
            }}
          >
            <LoginForm
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              redirectPath="/dashboard"
            />
          </Box>
        </Container>
      </Layout>
    </ErrorBoundary>
  );
});

// Display name for debugging
Login.displayName = 'Login';

export default Login;