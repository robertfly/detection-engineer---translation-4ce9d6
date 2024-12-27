import React, { useCallback, useEffect, useState } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import { Tooltip as MuiTooltip } from '@mui/material';
import { COLORS, TYPOGRAPHY, SPACING, TRANSITIONS } from '../../styles/variables';

// Interface for enhanced tooltip props with accessibility options
interface TooltipProps {
  title: string | React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  arrow?: boolean;
  delay?: number;
  ariaLabel?: string;
  highContrast?: boolean;
  reducedMotion?: boolean;
}

// Enhanced tooltip styles with accessibility considerations
const tooltipStyles = {
  backgroundColor: alpha(COLORS.grey[900], 0.95),
  color: COLORS.grey[50],
  fontSize: TYPOGRAPHY.fontSizes.sm,
  fontWeight: TYPOGRAPHY.fontWeights.medium,
  padding: SPACING.sizes.xs,
  borderRadius: SPACING.sizes.xs,
  maxWidth: '300px',
  transition: `all ${TRANSITIONS.duration.fast}ms ${TRANSITIONS.easing.easeInOut}`,
  zIndex: 1500,
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  lineHeight: 1.5,
  wordBreak: 'break-word' as const
};

// Styled tooltip component with comprehensive theme integration
const StyledTooltip = styled(({ className, ...props }: any) => (
  <MuiTooltip {...props} classes={{ popper: className }} />
))(({ theme, highContrast, reducedMotion }) => ({
  '& .MuiTooltip-tooltip': {
    ...tooltipStyles,
    // High contrast mode styles
    ...(highContrast && {
      backgroundColor: COLORS.highContrast.background,
      color: COLORS.highContrast.text,
      border: `2px solid ${COLORS.highContrast.border}`,
      fontWeight: TYPOGRAPHY.fontWeights.semibold,
    }),
    // Reduced motion preferences
    ...(reducedMotion && {
      transition: 'none',
    }),
    // RTL support
    [theme.direction === 'rtl' ? 'marginLeft' : 'marginRight']: SPACING.sizes.xs,
  },
  // Arrow styles with proper positioning
  '& .MuiTooltip-arrow': {
    color: highContrast ? COLORS.highContrast.border : alpha(COLORS.grey[900], 0.95),
    fontSize: SPACING.sizes.sm,
  },
  // Focus visible styles for keyboard navigation
  '& .MuiTooltip-tooltipPlacementTop': {
    marginBottom: SPACING.sizes.xs,
  },
  '& .MuiTooltip-tooltipPlacementBottom': {
    marginTop: SPACING.sizes.xs,
  },
  '& .MuiTooltip-tooltipPlacementLeft': {
    marginRight: SPACING.sizes.xs,
  },
  '& .MuiTooltip-tooltipPlacementRight': {
    marginLeft: SPACING.sizes.xs,
  },
}));

// Utility function for optimal tooltip placement
const getTooltipPlacement = (
  preferredPlacement: TooltipProps['placement'],
  elementRect: DOMRect,
  isRTL: boolean
): TooltipProps['placement'] => {
  if (preferredPlacement !== 'auto') return preferredPlacement;

  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;
  const { top, bottom, left, right } = elementRect;

  // Calculate available space in each direction
  const spaceAbove = top;
  const spaceBelow = windowHeight - bottom;
  const spaceLeft = left;
  const spaceRight = windowWidth - right;

  // Consider RTL layout
  const horizontalSpace = isRTL ? spaceLeft : spaceRight;

  // Return optimal placement
  if (spaceBelow >= 100) return 'bottom';
  if (spaceAbove >= 100) return 'top';
  if (horizontalSpace >= 200) return 'right';
  return 'left';
};

// Enhanced tooltip component with full accessibility support
const CustomTooltip: React.FC<TooltipProps> = ({
  title,
  children,
  placement = 'auto',
  arrow = true,
  delay = 200,
  ariaLabel,
  highContrast = false,
  reducedMotion = false,
  ...props
}) => {
  const theme = useTheme();
  const [tooltipPlacement, setTooltipPlacement] = useState<TooltipProps['placement']>(placement);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Calculate optimal placement
  const handlePlacement = useCallback((element: HTMLElement) => {
    if (placement === 'auto') {
      const rect = element.getBoundingClientRect();
      const newPlacement = getTooltipPlacement(placement, rect, theme.direction === 'rtl');
      setTooltipPlacement(newPlacement);
    }
  }, [placement, theme.direction]);

  return (
    <StyledTooltip
      title={title}
      placement={tooltipPlacement}
      arrow={arrow}
      enterDelay={reducedMotion || prefersReducedMotion ? 0 : delay}
      enterNextDelay={reducedMotion || prefersReducedMotion ? 0 : delay}
      PopperProps={{
        popperOptions: {
          modifiers: [{
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
              padding: 8,
            },
          }],
        },
      }}
      componentsProps={{
        tooltip: {
          'aria-label': ariaLabel,
          role: 'tooltip',
        },
      }}
      highContrast={highContrast}
      reducedMotion={reducedMotion || prefersReducedMotion}
      onOpen={(e) => handlePlacement(e.currentTarget as HTMLElement)}
      {...props}
    >
      {children}
    </StyledTooltip>
  );
};

export default CustomTooltip;