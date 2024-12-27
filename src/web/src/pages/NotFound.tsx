// react version: 18.2.0
// @mui/material version: 5.14.0
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Button,
  Skeleton
} from '@mui/material';

// Internal imports
import Layout from '../components/common/Layout';
import { ROUTES } from '../config/routes';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { logger } from '../utils/logger';

/**
 * Enhanced 404 Not Found page component with accessibility features
 * and comprehensive error tracking.
 */
const NotFound: React.FC = React.memo(() => {
  const navigate = useNavigate();

  /**
   * Handle navigation back to dashboard with error logging
   */
  const handleReturn = useCallback(() => {
    logger.info('User navigating from 404 page to dashboard', {
      from: window.location.pathname,
      to: ROUTES.DASHBOARD
    });
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

  return (
    <ErrorBoundary>
      <Layout>
        <Container
          component="main"
          role="main"
          aria-label="404 Error Page"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 200px)',
            textAlign: 'center'
          }}
        >
          {/* Error Status */}
          <Typography
            variant="h1"
            component="h1"
            color="primary"
            sx={{
              fontSize: {
                xs: '4rem',
                sm: '6rem'
              },
              mb: 1,
              fontWeight: 'bold'
            }}
            aria-live="polite"
          >
            404
          </Typography>

          {/* Error Message */}
          <Typography
            variant="h2"
            component="h2"
            sx={{
              fontSize: {
                xs: '1.5rem',
                sm: '2rem'
              },
              mb: 4,
              color: 'text.secondary'
            }}
          >
            Page Not Found
          </Typography>

          {/* Error Description */}
          <Typography
            variant="body1"
            color="text.secondary"
            paragraph
            sx={{ maxWidth: '600px', mb: 4 }}
          >
            The page you are looking for might have been removed, had its name
            changed, or is temporarily unavailable. Please check the URL or return
            to the dashboard.
          </Typography>

          {/* Navigation Button */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleReturn}
              size="large"
              aria-label="Return to dashboard"
              sx={{
                minWidth: '200px',
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineOffset: '2px'
                }
              }}
            >
              Return to Dashboard
            </Button>
          </Box>

          {/* Loading State Placeholder */}
          {false && (
            <Box sx={{ width: '100%', maxWidth: 600 }}>
              <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="60%" sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" />
            </Box>
          )}

          {/* Accessibility Announcer */}
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            404 error - Page not found
          </div>
        </Container>
      </Layout>
    </ErrorBoundary>
  );
});

// Display name for debugging
NotFound.displayName = 'NotFound';

export default NotFound;