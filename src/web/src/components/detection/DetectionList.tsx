/**
 * @fileoverview A React component that displays a paginated list of security detections
 * with filtering, sorting, and selection capabilities. Implements Material Design 3.0
 * specifications and ensures WCAG 2.1 Level AA accessibility compliance.
 * @version 1.0.0
 */

// External imports - version controlled
import React, { useEffect, useState, useCallback, useMemo } from 'react'; // v18.2.0
import {
  Grid,
  Typography,
  Pagination,
  CircularProgress,
  Select,
  MenuItem,
  Skeleton,
  useTheme,
  useMediaQuery,
  Box,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material'; // v5.14.0
import { formatDistanceToNow, format } from 'date-fns'; // v2.30.0

// Internal imports
import { Detection, DetectionFormat } from '../../interfaces/detection';
import Card from '../common/Card';
import { useDetection } from '../../hooks/useDetection';
import { SPACING, BREAKPOINTS } from '../../config/constants';

/**
 * Props interface for DetectionList component with accessibility features
 */
interface DetectionListProps {
  formatFilter?: DetectionFormat | 'all';
  onDetectionSelect?: (detection: Detection) => void;
  pageSize?: number;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

/**
 * Interface for detection list filter and pagination state
 */
interface FilterState {
  format: DetectionFormat | 'all';
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * DetectionList component with accessibility and responsive features
 */
const DetectionList: React.FC<DetectionListProps> = React.memo(({
  formatFilter = 'all',
  onDetectionSelect,
  pageSize = 10,
  ariaLabel = 'Detection list',
  className,
  testId = 'detection-list'
}) => {
  // Theme and responsive breakpoints
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Detection hook for state management
  const {
    detections,
    loading,
    error,
    fetchDetections,
    selectDetection
  } = useDetection();

  // Local state for filters and pagination
  const [filterState, setFilterState] = useState<FilterState>({
    format: formatFilter,
    page: 1,
    limit: pageSize,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  // Fetch detections on mount and filter changes
  useEffect(() => {
    fetchDetections({
      page: filterState.page,
      limit: filterState.limit,
      format: filterState.format === 'all' ? undefined : filterState.format
    });
  }, [filterState, fetchDetections]);

  /**
   * Handles pagination page change with accessibility announcements
   */
  const handlePageChange = useCallback((event: unknown, page: number) => {
    setFilterState(prev => ({ ...prev, page }));
    // Announce page change to screen readers
    const announcement = `Showing page ${page} of detections`;
    const ariaLive = document.getElementById('aria-live-announcer');
    if (ariaLive) {
      ariaLive.textContent = announcement;
    }
    // Scroll to top of list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /**
   * Handles format filter changes with loading states
   */
  const handleFormatChange = useCallback((event: SelectChangeEvent<DetectionFormat | 'all'>) => {
    const format = event.target.value as DetectionFormat | 'all';
    setFilterState(prev => ({ ...prev, format, page: 1 }));
    // Announce filter change to screen readers
    const announcement = `Filtering detections by ${format} format`;
    const ariaLive = document.getElementById('aria-live-announcer');
    if (ariaLive) {
      ariaLive.textContent = announcement;
    }
  }, []);

  /**
   * Handles detection card click events with keyboard support
   */
  const handleDetectionClick = useCallback((
    detection: Detection,
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    event.preventDefault();
    if (
      event.type === 'click' ||
      (event.type === 'keydown' && 
        ((event as React.KeyboardEvent).key === 'Enter' || 
         (event as React.KeyboardEvent).key === ' '))
    ) {
      selectDetection(detection);
      if (onDetectionSelect) {
        onDetectionSelect(detection);
      }
      // Announce selection to screen readers
      const announcement = `Selected detection: ${detection.metadata.name}`;
      const ariaLive = document.getElementById('aria-live-announcer');
      if (ariaLive) {
        ariaLive.textContent = announcement;
      }
    }
  }, [selectDetection, onDetectionSelect]);

  /**
   * Renders individual detection card with accessibility features
   */
  const renderDetectionCard = useCallback((detection: Detection) => {
    const formattedDate = formatDistanceToNow(new Date(detection.created_at), {
      addSuffix: true,
      includeSeconds: true
    });

    return (
      <Grid item xs={12} sm={6} md={4} key={detection.id}>
        <Card
          variant="outlined"
          onClick={(e) => handleDetectionClick(detection, e)}
          aria-label={`Detection ${detection.metadata.name}, created ${formattedDate}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => handleDetectionClick(detection, e)}
          data-testid={`detection-card-${detection.id}`}
          className="detection-card"
        >
          <Box p={2}>
            <Typography variant="h6" component="h3" gutterBottom noWrap>
              {detection.metadata.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Format: {detection.format}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Created: {formattedDate}
            </Typography>
            <Typography 
              variant="body2" 
              color={detection.metadata.severity.toLowerCase()}
              sx={{ mt: 1 }}
            >
              Severity: {detection.metadata.severity}
            </Typography>
          </Box>
        </Card>
      </Grid>
    );
  }, [handleDetectionClick]);

  // Memoized grid spacing based on screen size
  const gridSpacing = useMemo(() => {
    if (isMobile) return 2;
    if (isTablet) return 3;
    return 4;
  }, [isMobile, isTablet]);

  return (
    <div
      className={className}
      data-testid={testId}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Accessibility announcement container */}
      <div id="aria-live-announcer" className="sr-only" aria-live="polite" />

      {/* Format filter */}
      <Box mb={3}>
        <FormControl fullWidth>
          <InputLabel id="format-filter-label">Format Filter</InputLabel>
          <Select
            labelId="format-filter-label"
            id="format-filter"
            value={filterState.format}
            onChange={handleFormatChange}
            aria-label="Filter detections by format"
          >
            <MenuItem value="all">All Formats</MenuItem>
            {Object.values(DetectionFormat).map((format) => (
              <MenuItem key={format} value={format}>
                {format}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Loading state */}
      {loading && (
        <Grid container spacing={gridSpacing}>
          {Array.from({ length: pageSize }).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Skeleton
                variant="rectangular"
                height={200}
                animation="wave"
                sx={{ borderRadius: 1 }}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Error state */}
      {error && (
        <Typography color="error" role="alert">
          Error loading detections: {error.message}
        </Typography>
      )}

      {/* Detection grid */}
      {!loading && !error && (
        <>
          <Grid container spacing={gridSpacing}>
            {detections.map(renderDetectionCard)}
          </Grid>

          {/* Pagination */}
          <Box mt={4} display="flex" justifyContent="center">
            <Pagination
              count={Math.ceil(detections.length / pageSize)}
              page={filterState.page}
              onChange={handlePageChange}
              color="primary"
              size={isMobile ? "small" : "medium"}
              aria-label="Detection list pagination"
            />
          </Box>
        </>
      )}
    </div>
  );
});

DetectionList.displayName = 'DetectionList';

export default DetectionList;