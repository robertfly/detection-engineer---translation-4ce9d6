import React, { useCallback, useMemo } from 'react';
import { FormControl, FormHelperText, useTheme } from '@mui/material'; // version: 5.14.0
import Dropdown from '../common/Dropdown';
import { DetectionFormat, isValidDetectionFormat } from '../../interfaces/detection';

/**
 * Props interface for the FormatSelector component with enhanced accessibility support
 */
interface FormatSelectorProps {
  /** Label for the format selector */
  label: string;
  /** Currently selected detection format */
  value: DetectionFormat;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Whether the selector is in an error state */
  error?: boolean;
  /** Helper text to display below the selector */
  helperText?: string;
  /** Callback function when format changes */
  onChange: (format: DetectionFormat) => void;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** ID of element that describes this selector */
  ariaDescribedBy?: string;
}

/**
 * Enhanced format selector component for security detection translations.
 * Implements Material Design 3.0 with comprehensive accessibility features.
 */
const FormatSelector: React.FC<FormatSelectorProps> = ({
  label,
  value,
  disabled = false,
  error = false,
  helperText,
  onChange,
  ariaLabel,
  ariaDescribedBy
}) => {
  const theme = useTheme();

  /**
   * Memoized format options to prevent unnecessary recalculations
   */
  const formatOptions = useMemo(() => {
    return Object.values(DetectionFormat).map(format => ({
      label: format.replace('_', ' '),
      value: format
    }));
  }, []);

  /**
   * Enhanced format selection handler with validation and accessibility
   */
  const handleFormatChange = useCallback((selectedFormat: string) => {
    // Validate the selected format
    if (!isValidDetectionFormat(selectedFormat)) {
      console.error(`Invalid detection format selected: ${selectedFormat}`);
      return;
    }

    // Convert string to DetectionFormat enum value
    const format = DetectionFormat[selectedFormat as keyof typeof DetectionFormat];
    
    // Call onChange with the new format
    onChange(format);

    // Announce format change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Selected format: ${format.replace('_', ' ')}`;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [onChange]);

  /**
   * Format the current value for display
   */
  const displayValue = useMemo(() => {
    return value ? value.toString() : '';
  }, [value]);

  return (
    <FormControl
      fullWidth
      error={error}
      disabled={disabled}
    >
      <Dropdown
        label={label}
        value={displayValue}
        options={formatOptions.map(opt => opt.value)}
        onChange={handleFormatChange}
        disabled={disabled}
        error={error}
        helperText={helperText}
        ariaLabel={ariaLabel || 'Select detection format'}
        ariaDescribedBy={ariaDescribedBy}
        placeholder="Select a format"
        reducedMotion={theme.transitions?.reducedMotion?.prefersReduced}
      />
      
      {helperText && (
        <FormHelperText
          error={error}
          id={ariaDescribedBy}
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default FormatSelector;