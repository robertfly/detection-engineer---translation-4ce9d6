// @mui/material/styles version: 5.14.0
import { styled } from '@mui/material/styles';
// @mui/material version: 5.14.0
import { Button, Card, TextField, Select, Modal } from '@mui/material';
// @emotion/react version: 11.11.0
import { css } from '@emotion/react';

import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BREAKPOINTS,
  SHADOWS,
  TRANSITIONS
} from './variables';

// Accessibility-focused style constants
const accessibilityStyles = {
  focusVisible: css`
    outline: 2px solid ${COLORS.primary.main};
    outline-offset: 2px;
    box-shadow: ${SHADOWS.elevation[2]};
  `,
  highContrastOutline: css`
    @media (forced-colors: active) {
      outline: 2px solid ${COLORS.highContrast.border};
    }
  `,
  reducedMotion: css`
    @media (prefers-reduced-motion: reduce) {
      transition: none !important;
      animation: none !important;
    }
  `,
  touchTarget: css`
    min-height: 44px;
    min-width: 44px;
  `
};

// Function to create responsive spacing
const createResponsiveSpacing = (spacingConfig: any) => css`
  ${BREAKPOINTS.mediaQueries.up.xs} {
    padding: ${spacingConfig.mobile || SPACING.sizes.sm};
  }
  ${BREAKPOINTS.mediaQueries.up.sm} {
    padding: ${spacingConfig.tablet || SPACING.sizes.md};
  }
  ${BREAKPOINTS.mediaQueries.up.md} {
    padding: ${spacingConfig.desktop || SPACING.sizes.lg};
  }
`;

// Enhanced Button component with accessibility features
export const StyledButton = styled(Button)`
  font-family: ${TYPOGRAPHY.fontFamily};
  font-weight: ${TYPOGRAPHY.fontWeights.medium};
  font-size: ${TYPOGRAPHY.fontSizes.base};
  line-height: ${TYPOGRAPHY.lineHeights.base};
  padding: ${SPACING.sizes.sm} ${SPACING.sizes.lg};
  border-radius: ${SPACING.sizes.xs};
  text-transform: none;
  ${accessibilityStyles.touchTarget}

  // Enhanced states with WCAG compliance
  &:hover {
    background-color: ${({ variant }) =>
      variant === 'contained' ? COLORS.primary.states.hover : 'transparent'};
  }

  &:active {
    background-color: ${({ variant }) =>
      variant === 'contained' ? COLORS.primary.states.pressed : 'transparent'};
  }

  &.Mui-focusVisible {
    ${accessibilityStyles.focusVisible}
  }

  &.Mui-disabled {
    background-color: ${COLORS.primary.states.disabled};
    color: ${COLORS.grey[600]};
  }

  ${accessibilityStyles.reducedMotion}
  ${accessibilityStyles.highContrastOutline}

  transition: all ${TRANSITIONS.duration.short}ms ${TRANSITIONS.easing.easeInOut};
`;

// Enhanced Card component with proper elevation and spacing
export const StyledCard = styled(Card)`
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${SPACING.sizes.sm};
  box-shadow: ${SHADOWS.elevation[1]};
  
  ${createResponsiveSpacing({
    mobile: SPACING.compounds.cardPadding,
    tablet: SPACING.compounds.cardPadding,
    desktop: SPACING.compounds.cardPadding
  })}

  &:hover {
    box-shadow: ${SHADOWS.elevation[2]};
  }

  ${accessibilityStyles.highContrastOutline}
  
  transition: box-shadow ${TRANSITIONS.duration.short}ms ${TRANSITIONS.easing.easeInOut};
  ${accessibilityStyles.reducedMotion}
`;

// Enhanced TextField with accessibility features
export const StyledTextField = styled(TextField)`
  .MuiInputBase-root {
    font-family: ${TYPOGRAPHY.fontFamily};
    font-size: ${TYPOGRAPHY.fontSizes.base};
    min-height: 44px; // WCAG touch target size
    
    // Enhanced border states
    .MuiOutlinedInput-notchedOutline {
      border-color: ${COLORS.grey[300]};
    }
    
    &:hover .MuiOutlinedInput-notchedOutline {
      border-color: ${COLORS.grey[400]};
    }
    
    &.Mui-focused .MuiOutlinedInput-notchedOutline {
      border-color: ${COLORS.primary.main};
      border-width: 2px;
    }
    
    &.Mui-error .MuiOutlinedInput-notchedOutline {
      border-color: ${COLORS.error.main};
    }
  }

  // Label styling
  .MuiInputLabel-root {
    font-family: ${TYPOGRAPHY.fontFamily};
    font-size: ${TYPOGRAPHY.fontSizes.base};
    color: ${COLORS.grey[700]};
    
    &.Mui-focused {
      color: ${COLORS.primary.main};
    }
    
    &.Mui-error {
      color: ${COLORS.error.main};
    }
  }

  // Helper text styling
  .MuiFormHelperText-root {
    font-size: ${TYPOGRAPHY.fontSizes.sm};
    margin-top: ${SPACING.sizes.xs};
    
    &.Mui-error {
      color: ${COLORS.error.main};
    }
  }

  ${accessibilityStyles.reducedMotion}
  ${accessibilityStyles.highContrastOutline}
`;

// Enhanced Select component with accessibility
export const StyledSelect = styled(Select)`
  .MuiSelect-select {
    min-height: 44px; // WCAG touch target size
    padding: ${SPACING.sizes.sm} ${SPACING.sizes.md};
    font-family: ${TYPOGRAPHY.fontFamily};
    font-size: ${TYPOGRAPHY.fontSizes.base};
  }

  &.Mui-focused .MuiOutlinedInput-notchedOutline {
    border-color: ${COLORS.primary.main};
    border-width: 2px;
  }

  ${accessibilityStyles.focusVisible}
  ${accessibilityStyles.reducedMotion}
  ${accessibilityStyles.highContrastOutline}
`;

// Enhanced Modal with accessibility features
export const StyledModal = styled(Modal)`
  .MuiModal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }

  .MuiModal-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: ${({ theme }) => theme.palette.background.paper};
    border-radius: ${SPACING.sizes.sm};
    padding: ${SPACING.sizes.xl};
    outline: none;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    
    ${BREAKPOINTS.mediaQueries.up.sm} {
      min-width: 400px;
    }

    &:focus {
      ${accessibilityStyles.focusVisible}
    }
  }

  ${accessibilityStyles.reducedMotion}
`;