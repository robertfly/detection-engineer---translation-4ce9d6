/**
 * @fileoverview A comprehensive Material Design 3.0 tab component with enhanced accessibility
 * Provides performant, customizable tab navigation with RTL support and keyboard navigation
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { Tabs as MuiTabs, Tab as MuiTab, Box } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { StyledIcon } from './Icon';

// Constants for tab variants and orientations
export const TAB_VARIANTS = {
  STANDARD: 'standard',
  FULL_WIDTH: 'fullWidth',
  SCROLLABLE: 'scrollable',
} as const;

export const TAB_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
} as const;

// Interface definitions
export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: typeof TAB_ORIENTATIONS[keyof typeof TAB_ORIENTATIONS];
  variant?: typeof TAB_VARIANTS[keyof typeof TAB_VARIANTS];
  className?: string;
  enableTouchRipple?: boolean;
}

// Styled components with theme integration
const StyledTabs = styled(MuiTabs, {
  shouldForwardProp: (prop) => !['orientation', 'variant'].includes(prop as string),
})(({ theme, orientation, variant }) => ({
  borderBottom: orientation === TAB_ORIENTATIONS.HORIZONTAL 
    ? `1px solid ${theme.palette.divider}` 
    : 'none',
  borderRight: orientation === TAB_ORIENTATIONS.VERTICAL 
    ? `1px solid ${theme.palette.divider}` 
    : 'none',
  minHeight: orientation === TAB_ORIENTATIONS.HORIZONTAL ? 48 : 'auto',
  '& .MuiTabs-indicator': {
    backgroundColor: theme.palette.primary.main,
    transition: theme.transitions.create(['width', 'height'], {
      duration: theme.transitions.duration.shorter,
    }),
  },
  '& .MuiTabs-flexContainer': {
    gap: theme.spacing(1),
  },
  ...(variant === TAB_VARIANTS.SCROLLABLE && {
    [theme.breakpoints.down('sm')]: {
      maxWidth: '100vw',
      overflow: 'auto',
      scrollSnapType: 'x mandatory',
    },
  }),
}));

const StyledTab = styled(MuiTab, {
  shouldForwardProp: (prop) => !['disabled'].includes(prop as string),
})(({ theme, disabled }) => ({
  textTransform: 'none',
  minWidth: 90,
  padding: theme.spacing(1, 2),
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.secondary,
  '&.Mui-selected': {
    color: theme.palette.primary.main,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '& .MuiTab-iconWrapper': {
    marginRight: theme.spacing(1),
    marginBottom: 0,
  },
  [theme.breakpoints.down('sm')]: {
    scrollSnapAlign: 'start',
  },
}));

/**
 * Enhanced tab component with comprehensive accessibility and performance features
 */
export const Tabs: React.FC<TabsProps> = memo(({
  items,
  value: controlledValue,
  defaultValue,
  onChange,
  orientation = TAB_ORIENTATIONS.HORIZONTAL,
  variant = TAB_VARIANTS.STANDARD,
  className,
  enableTouchRipple = true,
}) => {
  const theme = useTheme();
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue || items[0]?.id || ''
  );

  // Handle controlled/uncontrolled state
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Handle tab change with proper focus management
  const handleChange = useCallback((_: React.SyntheticEvent, newValue: string) => {
    if (!controlledValue) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  }, [controlledValue, onChange]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentIndex = items.findIndex(item => item.id === value);
      let newIndex: number;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          newIndex = (currentIndex + 1) % items.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          newIndex = (currentIndex - 1 + items.length) % items.length;
          break;
        default:
          return;
      }

      // Skip disabled tabs
      while (items[newIndex].disabled) {
        newIndex = (newIndex + 1) % items.length;
      }

      handleChange(null as any, items[newIndex].id);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, value, handleChange]);

  return (
    <Box
      role="tablist"
      aria-orientation={orientation}
      className={className}
    >
      <StyledTabs
        value={value}
        onChange={handleChange}
        orientation={orientation}
        variant={variant}
        aria-label="Navigation tabs"
        allowScrollButtonsMobile
        scrollButtons="auto"
      >
        {items.map((item) => (
          <StyledTab
            key={item.id}
            value={item.id}
            label={item.label}
            disabled={item.disabled}
            icon={item.icon ? (
              <StyledIcon
                type={item.icon as any}
                size="small"
                aria-hidden="true"
              />
            ) : undefined}
            aria-label={item.ariaLabel || item.label}
            TouchRippleProps={{
              disabled: !enableTouchRipple
            }}
            tabIndex={value === item.id ? 0 : -1}
          />
        ))}
      </StyledTabs>
    </Box>
  );
});

Tabs.displayName = 'Tabs';

export default Tabs;