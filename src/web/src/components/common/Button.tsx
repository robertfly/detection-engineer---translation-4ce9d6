// @mui/material version: 5.14.0
// @mui/material/styles version: 5.14.0
// react version: 18.2.0
import React, { useCallback, useEffect, useState } from 'react';
import { Button as MuiButton } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { COLORS, TYPOGRAPHY, SPACING, TRANSITIONS } from '../../styles/variables';
import { StyledButton } from '../../styles/components';

// Enhanced ButtonProps interface extending MUI ButtonProps
interface ButtonProps extends React.ComponentPropsWithoutRef<typeof MuiButton> {
  variant?: 'contained' | 'outlined' | 'text' | 'tonal';
  size?: 'small' | 'medium' | 'large' | 'touch';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'inherit';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  tooltip?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

// Get size-specific styles including touch targets
const getButtonSize = (size: string, isTouchDevice: boolean) => {
  const baseStyles = {
    minHeight: isTouchDevice ? '44px' : '36px', // WCAG touch target size
    minWidth: isTouchDevice ? '44px' : '64px',
  };

  const sizeStyles = {
    small: {
      ...baseStyles,
      padding: `${SPACING.sizes.xs} ${SPACING.sizes.sm}`,
      fontSize: TYPOGRAPHY.fontSizes.sm,
      lineHeight: TYPOGRAPHY.lineHeights.tight,
    },
    medium: {
      ...baseStyles,
      padding: `${SPACING.sizes.sm} ${SPACING.sizes.md}`,
      fontSize: TYPOGRAPHY.fontSizes.base,
      lineHeight: TYPOGRAPHY.lineHeights.base,
    },
    large: {
      ...baseStyles,
      padding: `${SPACING.sizes.md} ${SPACING.sizes.lg}`,
      fontSize: TYPOGRAPHY.fontSizes.lg,
      lineHeight: TYPOGRAPHY.lineHeights.relaxed,
    },
    touch: {
      minHeight: '44px',
      minWidth: '44px',
      padding: `${SPACING.sizes.md} ${SPACING.sizes.lg}`,
      fontSize: TYPOGRAPHY.fontSizes.base,
      lineHeight: TYPOGRAPHY.lineHeights.base,
    },
  };

  return sizeStyles[size] || sizeStyles.medium;
};

// Custom hook for button animations
const useButtonAnimation = (disabled: boolean, prefersReducedMotion: boolean) => {
  const duration = prefersReducedMotion ? 0 : TRANSITIONS.duration.short;
  
  return {
    transition: `all ${duration}ms ${TRANSITIONS.easing.easeInOut}`,
    transform: disabled ? 'none' : undefined,
    '&:hover': {
      transform: disabled || prefersReducedMotion ? 'none' : 'translateY(-1px)',
    },
    '&:active': {
      transform: disabled || prefersReducedMotion ? 'none' : 'translateY(0)',
    },
  };
};

// Enhanced Button component
export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  size = 'medium',
  color = 'primary',
  fullWidth = false,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  tooltip,
  ariaLabel,
  children,
  onClick,
  ...props
}) => {
  const theme = useTheme();
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for touch device and reduced motion preferences
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window);
    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Enhanced click handler with loading state management
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    onClick?.(event);
  }, [disabled, loading, onClick]);

  // Get size-specific styles
  const sizeStyles = getButtonSize(size, isTouchDevice);
  
  // Get animation properties
  const animationStyles = useButtonAnimation(disabled, prefersReducedMotion);

  // Determine color styles based on variant and color prop
  const getColorStyles = () => {
    if (variant === 'contained') {
      return {
        backgroundColor: COLORS[color].main,
        color: COLORS[color].contrastText,
        '&:hover': {
          backgroundColor: COLORS[color].states?.hover || COLORS[color].light,
        },
      };
    }
    if (variant === 'tonal') {
      return {
        backgroundColor: COLORS[color].light,
        color: COLORS[color].dark,
      };
    }
    return {
      color: COLORS[color].main,
    };
  };

  return (
    <StyledButton
      variant={variant}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      title={tooltip}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
      endIcon={endIcon}
      sx={{
        ...sizeStyles,
        ...animationStyles,
        ...getColorStyles(),
        opacity: loading ? 0.8 : 1,
        cursor: loading ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        // High contrast mode support
        '@media (forced-colors: active)': {
          border: '2px solid currentColor',
          '&:focus-visible': {
            outline: '3px solid currentColor',
            outlineOffset: '2px',
          },
        },
        // Focus styles for keyboard navigation
        '&:focus-visible': {
          outline: `2px solid ${COLORS[color].main}`,
          outlineOffset: '2px',
          boxShadow: theme.shadows[2],
        },
      }}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button;