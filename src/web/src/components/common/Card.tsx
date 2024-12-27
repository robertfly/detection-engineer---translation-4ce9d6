// react version: 18.2.0
import React, { useCallback, useMemo } from 'react';
// @mui/material version: 5.14.0
import { Card as MuiCard, CardContent, CardActions } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

// Internal imports
import { StyledCard } from '../../styles/components';

// Interface for enhanced card props with accessibility support
interface CardProps {
  children: React.ReactNode;
  variant?: 'flat' | 'raised' | 'outlined';
  elevation?: number;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
  'aria-label'?: string;
  'data-testid'?: string;
  tabIndex?: number;
  role?: string;
  highContrast?: boolean;
  reducedMotion?: boolean;
  rtl?: boolean;
}

// Custom hook for managing card interactions and accessibility
const useCardInteraction = (props: CardProps) => {
  const {
    onClick,
    tabIndex = onClick ? 0 : -1,
    role = onClick ? 'button' : 'article'
  } = props;

  const handleKeyboardInteraction = useCallback(
    (event: React.KeyboardEvent) => {
      if (onClick && (event.key === 'Enter' || event.key === 'Space')) {
        event.preventDefault();
        onClick(event as unknown as React.MouseEvent);
      }
    },
    [onClick]
  );

  return {
    tabIndex,
    role,
    onKeyDown: onClick ? handleKeyboardInteraction : undefined
  };
};

// Function to determine elevation based on variant and theme
const getElevation = (variant: CardProps['variant'], theme: any): string => {
  const isLightMode = theme.palette.mode === 'light';
  const baseElevation = isLightMode ? 1 : 2;

  switch (variant) {
    case 'flat':
      return '0';
    case 'raised':
      return String(baseElevation + 1);
    case 'outlined':
      return '0';
    default:
      return String(baseElevation);
  }
};

// Enhanced StyledCard with additional accessibility features
const AccessibleCard = styled(StyledCard, {
  shouldForwardProp: (prop) => 
    !['highContrast', 'reducedMotion', 'rtl'].includes(prop as string)
})<CardProps>`
  // RTL Support
  direction: ${({ rtl }) => rtl ? 'rtl' : 'ltr'};
  text-align: ${({ rtl }) => rtl ? 'right' : 'left'};

  // High Contrast Mode
  ${({ highContrast, theme }) => highContrast && `
    @media (forced-colors: active) {
      border: 2px solid ${theme.palette.text.primary};
      forced-color-adjust: none;
    }
  `}

  // Reduced Motion
  ${({ reducedMotion }) => reducedMotion && `
    @media (prefers-reduced-motion: reduce) {
      transition: none !important;
    }
  `}

  // Interactive states
  ${({ onClick, theme }) => onClick && `
    cursor: pointer;
    
    &:hover {
      background-color: ${theme.palette.action.hover};
    }

    &:active {
      background-color: ${theme.palette.action.selected};
    }

    &:focus-visible {
      outline: 2px solid ${theme.palette.primary.main};
      outline-offset: 2px;
    }
  `}
`;

// Main Card component with accessibility enhancements
const Card = React.memo<CardProps>(({
  children,
  variant = 'flat',
  elevation,
  className,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  highContrast = false,
  reducedMotion = false,
  rtl = false,
  ...props
}) => {
  const theme = useTheme();
  const interactionProps = useCardInteraction({ onClick, ...props });

  const computedElevation = useMemo(() => 
    elevation ?? Number(getElevation(variant, theme)),
    [elevation, variant, theme]
  );

  return (
    <AccessibleCard
      variant={variant}
      elevation={computedElevation}
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      highContrast={highContrast}
      reducedMotion={reducedMotion}
      rtl={rtl}
      {...interactionProps}
      {...props}
    >
      {children}
    </AccessibleCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

// Export enhanced card component and its subcomponents
export { Card, CardContent, CardActions };
export type { CardProps };
export default Card;