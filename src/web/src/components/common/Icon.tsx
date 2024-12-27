/**
 * @fileoverview A highly reusable, accessible, and performant icon component
 * Provides a consistent interface for rendering Material UI icons with proper
 * accessibility, theme integration, and error handling
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { styled } from '@mui/material/styles';
import { SvgIcon } from '@mui/material';
import {
  HelpIcon,
  PaymentIcon,
  InfoIcon,
  AddIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UploadIcon,
  DashboardIcon,
  ProfileIcon,
  WarningIcon,
  SettingsIcon,
  FavoriteIcon,
} from '../../assets/icons';

// Type definitions
export type IconType =
  | 'help'
  | 'payment'
  | 'info'
  | 'add'
  | 'close'
  | 'chevronLeft'
  | 'chevronRight'
  | 'upload'
  | 'dashboard'
  | 'profile'
  | 'warning'
  | 'settings'
  | 'favorite';

export type IconSize = 'small' | 'medium' | 'large';

// Constants
const ICON_SIZES = {
  small: '20px',
  medium: '24px',
  large: '32px',
} as const;

const ICON_COMPONENTS = {
  help: HelpIcon,
  payment: PaymentIcon,
  info: InfoIcon,
  add: AddIcon,
  close: CloseIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  upload: UploadIcon,
  dashboard: DashboardIcon,
  profile: ProfileIcon,
  warning: WarningIcon,
  settings: SettingsIcon,
  favorite: FavoriteIcon,
} as const;

// Props interface
export interface IconProps {
  /** Type of icon to display */
  type: IconType;
  /** Size of the icon */
  size?: IconSize;
  /** Color of the icon - uses theme colors or custom color */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for the icon */
  onClick?: (event: React.MouseEvent<SVGSVGElement>) => void;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Test ID for testing purposes */
  testId?: string;
}

// Styled component for consistent icon rendering
const StyledIcon = styled(SvgIcon, {
  shouldForwardProp: (prop) => prop !== 'size',
})<{ size: IconSize }>(({ theme, size, color }) => ({
  width: ICON_SIZES[size],
  height: ICON_SIZES[size],
  color: color || 'inherit',
  transition: theme.transitions.create(['color', 'transform'], {
    duration: theme.transitions.duration.shorter,
  }),
  '&:hover': {
    color: theme.palette.primary.main,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  // Ensure proper RTL support
  transform: theme.direction === 'rtl' && 
    (size === 'chevronLeft' || size === 'chevronRight') 
    ? 'scaleX(-1)' 
    : 'none',
}));

/**
 * Get the appropriate icon component with type checking and error handling
 * @param type - The type of icon to retrieve
 * @returns The corresponding icon component or null if not found
 */
const getIconComponent = memo((type: IconType) => {
  const IconComponent = ICON_COMPONENTS[type];
  
  if (!IconComponent && process.env.NODE_ENV === 'development') {
    console.warn(`Icon type "${type}" not found`);
  }
  
  return IconComponent || null;
});

/**
 * A highly reusable icon component that provides a consistent interface for
 * rendering Material UI icons throughout the application
 */
export const Icon: React.FC<IconProps> = memo(({
  type,
  size = 'medium',
  color,
  className,
  onClick,
  ariaLabel,
  testId,
}) => {
  const IconComponent = getIconComponent(type);

  if (!IconComponent) {
    return null;
  }

  return (
    <StyledIcon
      as={IconComponent}
      size={size}
      color={color}
      className={className}
      onClick={onClick}
      aria-label={ariaLabel || type}
      data-testid={testId || `icon-${type}`}
      focusable={onClick ? 'true' : 'false'}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : -1}
    />
  );
});

Icon.displayName = 'Icon';

export default Icon;