import React from 'react'; // v18.2.0
import { LinearProgress, Box } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { COLORS, SPACING } from '../../styles/variables';

// Type definitions for component props
interface ProgressBarProps {
  /**
   * Current progress value between 0 and 100
   */
  value: number;
  /**
   * Visual style variant of the progress bar
   * @default 'info'
   */
  variant?: 'success' | 'warning' | 'error' | 'info';
  /**
   * Size variant affecting the height of the progress bar
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Toggle for percentage label display
   * @default false
   */
  showLabel?: boolean;
  /**
   * Optional CSS class for custom styling
   */
  className?: string;
  /**
   * Optional inline styles
   */
  style?: React.CSSProperties;
}

// Constants for component configuration
const PROGRESS_HEIGHTS = {
  small: '4px',
  medium: '8px',
  large: '12px'
} as const;

const VARIANT_COLORS = {
  success: COLORS.success.main,
  warning: COLORS.warning.main,
  error: COLORS.error.main,
  info: COLORS.primary.main
} as const;

// Styled components
const StyledLinearProgress = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== 'size' && prop !== 'variant'
})<{ size: keyof typeof PROGRESS_HEIGHTS; variant: keyof typeof VARIANT_COLORS }>(
  ({ theme, size, variant }) => ({
    borderRadius: SPACING.sizes.xs,
    height: PROGRESS_HEIGHTS[size],
    backgroundColor: theme.palette.mode === 'light' 
      ? theme.palette.grey[200] 
      : theme.palette.grey[800],
    '& .MuiLinearProgress-bar': {
      backgroundColor: VARIANT_COLORS[variant],
      transition: 'transform 0.3s ease-in-out',
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none'
      }
    }
  })
);

const ProgressLabel = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'variant'
})<{ variant: keyof typeof VARIANT_COLORS }>(({ theme, variant }) => ({
  marginTop: SPACING.sizes.xs,
  fontSize: theme.typography.caption.fontSize,
  color: VARIANT_COLORS[variant],
  textAlign: 'right',
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: 1.2,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

/**
 * ProgressBar component that provides visual feedback about an operation's progress
 * with support for different variants, sizes, and accessibility features.
 */
const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  value,
  variant = 'info',
  size = 'medium',
  showLabel = false,
  className,
  style
}) => {
  // Ensure value is within valid range
  const normalizedValue = Math.min(Math.max(0, value), 100);

  return (
    <Box className={className} style={style}>
      <StyledLinearProgress
        variant="determinate"
        value={normalizedValue}
        size={size}
        variant={variant}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
        aria-label={`Progress: ${normalizedValue}%`}
        role="progressbar"
      />
      {showLabel && (
        <ProgressLabel
          variant={variant}
          aria-hidden="true" // Hide from screen readers as value is already announced
        >
          {`${Math.round(normalizedValue)}%`}
        </ProgressLabel>
      )}
    </Box>
  );
});

// Display name for debugging
ProgressBar.displayName = 'ProgressBar';

// Default export
export default ProgressBar;

// Named exports for specific use cases
export type { ProgressBarProps };