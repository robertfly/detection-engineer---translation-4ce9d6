// @mui/material version: 5.14.0
// @mui/material/styles version: 5.14.0
// react version: 18.2.0
// react-dropzone version: 14.2.0
import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { styled } from '@mui/material/styles';
import { LinearProgress } from '@mui/material';
import { Button } from './Button';
import { StyledCard } from '../../styles/components';
import { DetectionFormat } from '../../interfaces/detection';
import { COLORS, SPACING, TRANSITIONS } from '../../styles/variables';

// File validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// File error interface for tracking validation failures
interface FileError {
  file: File;
  errors: string[];
}

// Component props interface
interface FileUploadProps {
  onFilesSelected: (files: File[], errors?: FileError[]) => void;
  acceptedFormats: DetectionFormat[];
  maxFileSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  showProgress?: boolean;
  progress?: number;
  ariaLabel?: string;
  errorMessages?: Record<string, string>;
}

// Styled components for the file upload area
const DropzoneContainer = styled('div')<{ isDragActive: boolean; isFocused: boolean }>(
  ({ theme, isDragActive, isFocused }) => ({
    border: `2px dashed ${isDragActive ? COLORS.primary.main : COLORS.grey[300]}`,
    borderRadius: SPACING.sizes.sm,
    padding: SPACING.sizes.xl,
    textAlign: 'center',
    cursor: 'pointer',
    outline: 'none',
    transition: `all ${TRANSITIONS.duration.short}ms ${TRANSITIONS.easing.easeInOut}`,
    backgroundColor: isDragActive ? COLORS.primary.light : 'transparent',
    opacity: isDragActive ? 0.8 : 1,
    
    '&:hover': {
      borderColor: COLORS.primary.main,
      backgroundColor: COLORS.primary.light,
      opacity: 0.8,
    },
    
    ...(isFocused && {
      boxShadow: theme.shadows[2],
      borderColor: COLORS.primary.main,
    }),
    
    // High contrast mode support
    '@media (forced-colors: active)': {
      border: '2px solid currentColor',
      '&:focus-visible': {
        outline: '3px solid currentColor',
        outlineOffset: '2px',
      },
    },
  })
);

const ProgressContainer = styled('div')({
  marginTop: SPACING.sizes.md,
  width: '100%',
});

const ErrorMessage = styled('div')({
  color: COLORS.error.main,
  marginTop: SPACING.sizes.sm,
  fontSize: '0.875rem',
});

// File validation function
const validateFile = (
  file: File,
  acceptedFormats: DetectionFormat[],
  maxFileSize: number
): ValidationResult => {
  const errors: string[] = [];
  
  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtensions = acceptedFormats.map(format => format.toLowerCase());
  if (!extension || !validExtensions.includes(extension)) {
    errors.push('invalidFormat');
  }

  // Check file size
  if (file.size > maxFileSize) {
    errors.push('sizeExceeded');
  }

  // Basic MIME type validation
  const validMimeTypes = [
    'text/plain',
    'application/json',
    'text/yaml',
    'application/x-yaml',
  ];
  if (!validMimeTypes.includes(file.type)) {
    errors.push('invalidType');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  acceptedFormats,
  maxFileSize = 5242880, // 5MB default
  maxFiles = 100,
  disabled = false,
  showProgress = false,
  progress = 0,
  ariaLabel = 'Upload detection files',
  errorMessages = {
    invalidFormat: 'File format not supported',
    sizeExceeded: 'File size exceeds limit',
    tooManyFiles: 'Too many files selected',
    invalidType: 'Invalid file type',
  },
}) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  // Handle file drop and validation
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return;

      const fileErrors: FileError[] = [];
      const validFiles: File[] = [];

      // Check max files limit
      if (acceptedFiles.length > maxFiles) {
        setErrors(['tooManyFiles']);
        return;
      }

      // Validate each file
      acceptedFiles.forEach(file => {
        const validation = validateFile(file, acceptedFormats, maxFileSize);
        if (validation.isValid) {
          validFiles.push(file);
        } else {
          fileErrors.push({ file, errors: validation.errors });
        }
      });

      // Update error state
      setErrors(fileErrors.flatMap(error => error.errors));

      // Announce results to screen readers
      const successMessage = validFiles.length > 0
        ? `Successfully uploaded ${validFiles.length} files`
        : '';
      const errorMessage = fileErrors.length > 0
        ? `${fileErrors.length} files failed validation`
        : '';
      
      if (successMessage || errorMessage) {
        const announcement = [successMessage, errorMessage].filter(Boolean).join('. ');
        const ariaLive = document.createElement('div');
        ariaLive.setAttribute('role', 'status');
        ariaLive.setAttribute('aria-live', 'polite');
        ariaLive.textContent = announcement;
        document.body.appendChild(ariaLive);
        setTimeout(() => document.body.removeChild(ariaLive), 1000);
      }

      // Call the callback with results
      onFilesSelected(validFiles, fileErrors.length > 0 ? fileErrors : undefined);
    },
    [acceptedFormats, disabled, maxFileSize, maxFiles, onFilesSelected]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive: dropzoneIsDragActive,
    isFocused,
  } = useDropzone({
    onDrop: handleDrop,
    disabled,
    noClick: disabled,
    noKeyboard: disabled,
  });

  // Update drag active state for visual feedback
  useEffect(() => {
    setIsDragActive(dropzoneIsDragActive);
  }, [dropzoneIsDragActive]);

  return (
    <StyledCard>
      <DropzoneContainer
        {...getRootProps()}
        isDragActive={isDragActive}
        isFocused={isFocused}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
      >
        <input {...getInputProps()} aria-label="File input" />
        <Button
          variant="outlined"
          color="primary"
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
        >
          Choose Files
        </Button>
        <div id="upload-instructions" style={{ marginTop: SPACING.sizes.md }}>
          Drag and drop files here or click to select files
        </div>
        <div style={{ marginTop: SPACING.sizes.sm, color: COLORS.grey[600] }}>
          Supported formats: {acceptedFormats.join(', ')}
        </div>
      </DropzoneContainer>

      {showProgress && (
        <ProgressContainer>
          <LinearProgress
            variant="determinate"
            value={progress}
            aria-label="Upload progress"
          />
        </ProgressContainer>
      )}

      {errors.length > 0 && (
        <ErrorMessage role="alert">
          {errors.map((error, index) => (
            <div key={index}>{errorMessages[error] || error}</div>
          ))}
        </ErrorMessage>
      )}
    </StyledCard>
  );
};

export default FileUpload;