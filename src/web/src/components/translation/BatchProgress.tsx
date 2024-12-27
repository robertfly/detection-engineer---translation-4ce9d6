import React, { useMemo } from 'react'; // v18.2.0
import { Box, Typography, Card, CardContent, CircularProgress } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0

// Internal imports
import ProgressBar from '../common/ProgressBar';
import { BatchTranslationStatus, TranslationJobStatus } from '../../interfaces/translation';
import { COLORS, SPACING, TRANSITIONS } from '../../styles/variables';

// Enhanced styled components with accessibility considerations
const ProgressContainer = styled(Card)(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  transition: TRANSITIONS.duration.standard,
  '&:hover': {
    boxShadow: theme.shadows[4]
  }
}));

const StatsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: theme.spacing(2),
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  '@media (max-width: 600px)': {
    flexDirection: 'column',
    alignItems: 'stretch'
  }
}));

const StatItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(1),
  minWidth: '120px',
  backgroundColor: theme.palette.mode === 'light' ? 
    theme.palette.grey[50] : 
    theme.palette.grey[900],
  borderRadius: theme.shape.borderRadius,
  transition: TRANSITIONS.duration.standard
}));

// Props interface with enhanced accessibility support
interface BatchProgressProps {
  /** Current batch translation status */
  status: BatchTranslationStatus;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * BatchProgress component displays the current progress of a batch translation operation
 * with enhanced accessibility features and performance metrics.
 */
const BatchProgress: React.FC<BatchProgressProps> = React.memo(({
  status,
  className,
  style,
  ariaLabel = 'Batch translation progress'
}) => {
  // Memoized calculations
  const progressPercentage = useMemo(() => {
    return Math.round((status.processedDetections / status.totalDetections) * 100);
  }, [status.processedDetections, status.totalDetections]);

  const progressVariant = useMemo(() => {
    if (status.status === TranslationJobStatus.FAILED) return 'error';
    if (status.failedTranslations > 0) return 'warning';
    return 'success';
  }, [status.status, status.failedTranslations]);

  const averageTimePerItem = useMemo(() => {
    if (status.processedDetections === 0) return 0;
    return Math.round(status.duration / status.processedDetections);
  }, [status.duration, status.processedDetections]);

  // Render loading state if no progress yet
  if (status.processedDetections === 0 && status.status === TranslationJobStatus.PROCESSING) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={2}>
        <CircularProgress aria-label="Initializing batch translation" />
      </Box>
    );
  }

  return (
    <ProgressContainer 
      className={className} 
      style={style}
      role="region"
      aria-label={ariaLabel}
    >
      <CardContent>
        {/* Status Header */}
        <Typography 
          variant="h6" 
          component="h2"
          aria-live="polite"
          gutterBottom
        >
          {status.status === TranslationJobStatus.COMPLETED ? 
            'Batch Translation Complete' : 
            'Processing Batch Translation'}
        </Typography>

        {/* Progress Bar */}
        <ProgressBar
          value={progressPercentage}
          variant={progressVariant}
          size="large"
          showLabel
          aria-label={`${progressPercentage}% complete`}
        />

        {/* Statistics */}
        <StatsContainer>
          <StatItem>
            <Typography variant="subtitle2" color="textSecondary">
              Processed
            </Typography>
            <Typography variant="h6">
              {status.processedDetections} / {status.totalDetections}
            </Typography>
          </StatItem>

          <StatItem>
            <Typography variant="subtitle2" color="textSecondary">
              Successful
            </Typography>
            <Typography 
              variant="h6"
              style={{ color: COLORS.success.main }}
            >
              {status.successfulTranslations}
            </Typography>
          </StatItem>

          <StatItem>
            <Typography variant="subtitle2" color="textSecondary">
              Failed
            </Typography>
            <Typography 
              variant="h6"
              style={{ color: COLORS.error.main }}
            >
              {status.failedTranslations}
            </Typography>
          </StatItem>

          <StatItem>
            <Typography variant="subtitle2" color="textSecondary">
              Avg. Time
            </Typography>
            <Typography variant="h6">
              {averageTimePerItem}ms
            </Typography>
          </StatItem>
        </StatsContainer>

        {/* Confidence Score */}
        {status.averageConfidence > 0 && (
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              Average Confidence Score: {Math.round(status.averageConfidence)}%
            </Typography>
          </Box>
        )}

        {/* Error Summary */}
        {Object.keys(status.errorSummary).length > 0 && (
          <Box 
            mt={2}
            role="alert"
            aria-live="polite"
          >
            <Typography variant="subtitle2" color="error">
              Translation Issues:
            </Typography>
            {Object.entries(status.errorSummary).map(([error, count]) => (
              <Typography 
                key={error} 
                variant="body2" 
                color="error"
                component="div"
              >
                • {error}: {count} occurrence(s)
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </ProgressContainer>
  );
});

// Display name for debugging
BatchProgress.displayName = 'BatchProgress';

export default BatchProgress;