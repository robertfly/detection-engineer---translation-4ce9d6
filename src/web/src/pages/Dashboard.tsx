/**
 * @fileoverview Main dashboard page component that provides an overview of security detections
 * and translation capabilities. Implements Material Design 3.0 specifications with enhanced
 * accessibility features and real-time updates.
 * @version 1.0.0
 */

// React version: 18.2.0
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Material UI version: 5.14.0
import {
  Grid,
  Typography,
  Box,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Skeleton,
} from '@mui/material';

// Internal imports
import Layout from '../components/common/Layout';
import DetectionList from '../components/detection/DetectionList';
import { useDetection } from '../hooks/useDetection';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useAnalytics } from '@analytics/react';
import { Detection } from '../interfaces/detection';
import { UI_CONSTANTS } from '../config/constants';

/**
 * Enhanced dashboard component with accessibility and real-time updates
 */
const Dashboard: React.FC = React.memo(() => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const analytics = useAnalytics();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Detection state management
  const {
    detections,
    loading,
    error,
    fetchDetections,
    selectDetection,
    clearError
  } = useDetection();

  // Local state for enhanced UX
  const [pageSize] = useState(isMobile ? 6 : 9);
  const [refreshInterval] = useState(30000); // 30 seconds

  /**
   * Handles detection selection with analytics tracking
   */
  const handleDetectionSelect = useCallback((detection: Detection) => {
    analytics.track('detection_selected', {
      detectionId: detection.id,
      format: detection.format,
      timestamp: new Date().toISOString()
    });

    selectDetection(detection);
    navigate(`/translation/single/${detection.id}`);
  }, [selectDetection, navigate, analytics]);

  /**
   * Effect for periodic data refresh
   */
  useEffect(() => {
    const fetchData = () => {
      fetchDetections({ page: 1, limit: pageSize });
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchDetections, pageSize, refreshInterval]);

  /**
   * Memoized grid spacing based on screen size
   */
  const gridSpacing = useMemo(() => {
    return isMobile ? 2 : 3;
  }, [isMobile]);

  /**
   * Renders loading skeleton during data fetch
   */
  const renderLoadingSkeleton = useCallback(() => (
    <Grid container spacing={gridSpacing}>
      {Array.from({ length: pageSize }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={`skeleton-${index}`}>
          <Skeleton
            variant="rectangular"
            height={200}
            animation="wave"
            sx={{ borderRadius: 1 }}
          />
        </Grid>
      ))}
    </Grid>
  ), [pageSize, gridSpacing]);

  return (
    <Layout>
      <ErrorBoundary>
        <Box
          component="main"
          role="main"
          aria-label="Detection Dashboard"
          sx={{
            flexGrow: 1,
            padding: theme.spacing(3),
            minHeight: '100vh',
            backgroundColor: theme.palette.background.default
          }}
        >
          {/* Dashboard Header */}
          <Grid container spacing={gridSpacing} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Typography
                variant={isMobile ? 'h5' : 'h4'}
                component="h1"
                gutterBottom
                sx={{ fontWeight: 'bold' }}
              >
                Detection Dashboard
              </Typography>
              <Typography
                variant="body1"
                color="textSecondary"
                sx={{ mb: 2 }}
              >
                Manage and translate your security detections across multiple platforms
              </Typography>
            </Grid>
          </Grid>

          {/* Error Display */}
          {error && (
            <Alert
              severity="error"
              onClose={clearError}
              sx={{ mb: 3 }}
              role="alert"
            >
              {error.message || 'An error occurred while loading detections'}
            </Alert>
          )}

          {/* Loading State */}
          {loading && renderLoadingSkeleton()}

          {/* Detection List */}
          {!loading && !error && (
            <DetectionList
              formatFilter="all"
              onDetectionSelect={handleDetectionSelect}
              pageSize={pageSize}
              ariaLabel="Security detections list"
              testId="dashboard-detection-list"
            />
          )}

          {/* No Data State */}
          {!loading && !error && detections.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 2
              }}
            >
              <Typography
                variant="h6"
                component="p"
                color="textSecondary"
                gutterBottom
              >
                No detections found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Create your first detection to get started
              </Typography>
            </Box>
          )}

          {/* Accessibility Announcer */}
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
            aria-atomic="true"
          >
            {loading ? 'Loading detections...' : ''}
            {error ? 'Error loading detections' : ''}
          </div>
        </Box>
      </ErrorBoundary>
    </Layout>
  );
});

// Display name for debugging
Dashboard.displayName = 'Dashboard';

export default Dashboard;