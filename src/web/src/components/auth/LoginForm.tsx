// @mui/material version: 5.14.0
// react version: 18.2.0
// react-router-dom version: 6.14.0
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';
import { logger } from '../../utils/logger';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/variables';

interface LoginFormProps {
  /**
   * Path to redirect after successful login
   */
  redirectPath?: string;
  /**
   * Callback function called after successful login
   */
  onSuccess?: (user: AuthUser) => void;
  /**
   * Callback function called on login error
   */
  onError?: (error: AuthError) => void;
}

/**
 * Enhanced login form component implementing OAuth 2.0 with Auth0
 * Follows WCAG 2.1 Level AA accessibility guidelines
 */
const LoginForm: React.FC<LoginFormProps> = ({
  redirectPath = '/dashboard',
  onSuccess,
  onError,
}) => {
  const navigate = useNavigate();
  const { login, isLoading, error, validateSession } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Reset error state when component unmounts
  useEffect(() => {
    return () => {
      setLoginError(null);
      setIsSubmitting(false);
    };
  }, []);

  // Validate existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const isValid = await validateSession();
        if (isValid) {
          navigate(redirectPath);
        }
      } catch (error) {
        logger.error('Session validation failed', { error });
      }
    };

    checkExistingSession();
  }, [validateSession, navigate, redirectPath]);

  /**
   * Enhanced login handler with security logging and error handling
   */
  const handleLogin = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    
    if (isSubmitting || isLoading) {
      return;
    }

    try {
      setIsSubmitting(true);
      setLoginError(null);

      logger.info('Initiating login process');
      await login();

      // Handle successful login
      logger.info('Login successful');
      onSuccess?.({} as AuthUser); // Type cast for demo
      navigate(redirectPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      logger.error('Login failed', { error });
      setLoginError(errorMessage);
      onError?.(error as AuthError);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isLoading, login, navigate, redirectPath, onSuccess, onError]);

  /**
   * Keyboard event handler for accessibility
   */
  const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = event.target as HTMLElement;
      target.click();
    }
  }, []);

  return (
    <Box
      component="main"
      role="main"
      aria-label="Login form"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: SPACING.sizes.xl,
        backgroundColor: COLORS.grey[50],
      }}
    >
      <Box
        component="section"
        sx={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'white',
          borderRadius: SPACING.sizes.sm,
          padding: SPACING.sizes.xl,
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Typography
          component="h1"
          variant="h4"
          sx={{
            textAlign: 'center',
            marginBottom: SPACING.sizes.xl,
            color: COLORS.grey[900],
            fontFamily: TYPOGRAPHY.fontFamily,
            fontWeight: TYPOGRAPHY.fontWeights.bold,
          }}
        >
          Detection Translator
        </Typography>

        {(loginError || error) && (
          <Alert
            severity="error"
            role="alert"
            aria-live="polite"
            sx={{ marginBottom: SPACING.sizes.lg }}
          >
            {loginError || error}
          </Alert>
        )}

        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          disabled={isSubmitting || isLoading}
          onClick={handleLogin}
          onKeyPress={handleKeyPress}
          aria-label="Sign in with Auth0"
          startIcon={isSubmitting || isLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
          sx={{
            height: '48px',
            fontSize: TYPOGRAPHY.fontSizes.base,
            fontWeight: TYPOGRAPHY.fontWeights.medium,
          }}
        >
          {isSubmitting || isLoading ? 'Signing in...' : 'Sign in with Auth0'}
        </Button>

        <Typography
          variant="body2"
          align="center"
          sx={{
            marginTop: SPACING.sizes.lg,
            color: COLORS.grey[600],
            fontSize: TYPOGRAPHY.fontSizes.sm,
          }}
        >
          Secure login powered by Auth0
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginForm;