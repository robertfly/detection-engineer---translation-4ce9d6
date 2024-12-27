import React, { useCallback, useRef, useState } from 'react';
import { 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  FormHelperText,
  SelectChangeEvent 
} from '@mui/material'; // version: 5.14.0
import { KeyboardArrowDown } from '@mui/icons-material'; // version: 5.14.0
import { StyledSelect } from '../../styles/components';

// Interface for component props with comprehensive accessibility options
interface DropdownProps {
  label: string;
  options: string[];
  value: string | string[];
  multiple?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
  onChange: (value: string | string[]) => void;
  reducedMotion?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

// Utility function for generating unique IDs
const generateUniqueId = (prefix: string): string => 
  `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  multiple = false,
  disabled = false,
  error = false,
  helperText,
  placeholder,
  onChange,
  reducedMotion = false,
  ariaLabel,
  ariaDescribedBy
}) => {
  // Refs and IDs for accessibility
  const selectRef = useRef<HTMLDivElement>(null);
  const labelId = generateUniqueId('dropdown-label');
  const helperId = generateUniqueId('dropdown-helper');

  // State for type-ahead search
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Handle value changes with accessibility announcements
  const handleChange = useCallback((event: SelectChangeEvent<string | string[]>) => {
    event.preventDefault();
    const newValue = event.target.value;
    
    // Handle array values for multiple select
    const processedValue = multiple 
      ? (typeof newValue === 'string' ? newValue.split(',') : newValue)
      : newValue;

    onChange(processedValue);

    // Announce selection to screen readers
    const announcement = multiple
      ? `Selected ${(processedValue as string[]).join(', ')}`
      : `Selected ${processedValue}`;
    
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    
    setTimeout(() => {
      document.body.removeChild(ariaLive);
    }, 1000);
  }, [multiple, onChange]);

  // Enhanced keyboard navigation with type-ahead search
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle type-ahead search
    if (event.key.length === 1) {
      clearTimeout(searchTimeout.current);
      setSearchQuery(prev => prev + event.key);
      
      // Find and select matching option
      const matchingOption = options.find(option => 
        option.toLowerCase().startsWith(searchQuery.toLowerCase())
      );
      
      if (matchingOption) {
        onChange(matchingOption);
      }

      // Clear search query after delay
      searchTimeout.current = setTimeout(() => {
        setSearchQuery('');
      }, 1500);
    }

    // Handle keyboard navigation
    switch (event.key) {
      case 'Home':
        event.preventDefault();
        if (options.length) onChange(options[0]);
        break;
      case 'End':
        event.preventDefault();
        if (options.length) onChange(options[options.length - 1]);
        break;
      case 'PageUp':
        event.preventDefault();
        const currentIndex = options.indexOf(value as string);
        const newIndex = Math.max(0, currentIndex - 5);
        onChange(options[newIndex]);
        break;
      case 'PageDown':
        event.preventDefault();
        const currIndex = options.indexOf(value as string);
        const nextIndex = Math.min(options.length - 1, currIndex + 5);
        onChange(options[nextIndex]);
        break;
    }
  }, [options, onChange, value, searchQuery]);

  return (
    <FormControl 
      fullWidth 
      error={error}
      disabled={disabled}
      aria-label={ariaLabel || label}
    >
      <InputLabel 
        id={labelId}
        error={error}
        shrink={Boolean(value)}
      >
        {label}
      </InputLabel>
      
      <StyledSelect
        ref={selectRef}
        labelId={labelId}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-describedby={ariaDescribedBy || (helperText ? helperId : undefined)}
        displayEmpty
        IconComponent={KeyboardArrowDown}
        renderValue={(selected) => {
          if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            return <em>{placeholder || 'Select an option'}</em>;
          }
          return Array.isArray(selected) ? selected.join(', ') : selected;
        }}
        sx={{
          '& .MuiSelect-select': {
            minHeight: '44px', // WCAG touch target size
          },
          ...(reducedMotion && {
            transition: 'none !important',
            animation: 'none !important'
          })
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option}
            value={option}
            role="option"
            aria-selected={multiple 
              ? (value as string[])?.includes(option)
              : value === option
            }
          >
            {option}
          </MenuItem>
        ))}
      </StyledSelect>

      {helperText && (
        <FormHelperText 
          id={helperId}
          error={error}
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default Dropdown;