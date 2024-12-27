// react version: 18.2.0
import React from 'react';
// @mui/material version: 5.14.0
import { CircularProgress, Box, Typography } from '@mui/material';
// @mui/material/styles version: 5.14.0
import { styled } from '@mui/material/styles';

import { StyledModal } from '../../styles/components';

// Size mapping following Material Design specifications
const LOADING_SIZES = {
  small: '24px',
  medium: '40px',
  large: '56px'
} as const;

interface LoadingProps {
  /**
   * Size variant of the loading indicator
   * @default 'medium'
   */
  size?: keyof typeof LOADING_SIZES;
  /**
   * Controls whether loading indicator appears in a full-screen modal
   * @default false
   */
  fullScreen?: boolean;
  /**
   * Accessible loading message
   */
  message?: string;
  /**
   * Additional CSS class names
   */
  className?: string;
}

// Styled container with accessibility optimizations
const StyledLoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  
  // Respect reduced motion preferences
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiCircularProgress-root': {
      animation: 'none',
      opacity: 0.5
    }
  },
  
  // High contrast mode support
  '@media (forced-colors: active)': {
    '& .MuiCircularProgress-root': {
      forcedColorAdjust: 'auto',
      color: 'CanvasText'
    }
  },

  // Optimize animation performance
  '& .MuiCircularProgress-root': {
    willChange: 'transform',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden'
  }
}));

/**
 * Loading component that provides visual feedback during asynchronous operations.
 * Implements Material Design 3.0 specifications and WCAG 2.1 Level AA accessibility standards.
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  fullScreen = false,
  message,
  className
}) => {
  // Loading content with accessibility features
  const loadingContent = (
    <StyledLoadingContainer
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
    >
      <CircularProgress
        size={LOADING_SIZES[size]}
        thickness={4}
        // Ensure proper color contrast for accessibility
        sx={(theme) => ({
          color: theme.palette.primary.main,
          '&.MuiCircularProgress-root': {
            animation: 'MuiCircularProgress-keyframes-circular-rotate 1.4s linear infinite'
          }
        })}
      />
      {message && (
        <Typography
          variant="body2"
          color="text.secondary"
          aria-label={message}
          sx={{ textAlign: 'center', maxWidth: '80%' }}
        >
          {message}
        </Typography>
      )}
    </StyledLoadingContainer>
  );

  // Handle full screen loading with modal
  if (fullScreen) {
    return (
      <StyledModal
        open={true}
        aria-labelledby="loading-modal"
        closeAfterTransition
        disableAutoFocus
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Ensure modal is above other content
          zIndex: (theme) => theme.zIndex.modal + 1
        }}
      >
        {loadingContent}
      </StyledModal>
    );
  }

  return loadingContent;
};

export default Loading;