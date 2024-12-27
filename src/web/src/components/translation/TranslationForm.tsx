/**
 * @fileoverview Enhanced translation form component with accessibility, validation,
 * and performance monitoring features.
 * @version 1.0.0
 */

// External imports
import React, { useState, useCallback, useEffect, useMemo } from 'react'; // v18.2.0
import { 
  FormControl, 
  FormHelperText, 
  TextField, 
  Select, 
  MenuItem,
  Button, 
  CircularProgress,
  Alert,
  Box,
  Typography
} from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import debounce from 'lodash/debounce'; // v4.17.21

// Internal imports
import { 
  TranslationRequest, 
  TranslationResult,
  TranslationMetrics,
  TranslationJobStatus 
} from '../../interfaces/translation';
import { DetectionFormat } from '../../interfaces/detection';
import { ValidationStatus } from '../../interfaces/validation';
import { useTranslation } from '../../hooks/useTranslation';

// Styled components
const StyledForm = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: theme.spacing(3),
}));

const EditorContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
  },
}));

const MetricsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}));

// Props interface
interface TranslationFormProps {
  onTranslationComplete: (result: TranslationResult, metrics: TranslationMetrics) => void;
  initialSourceFormat?: DetectionFormat;
  initialContent?: string;
  onError?: (error: Error) => void;
}

/**
 * Enhanced translation form component with accessibility and performance features
 */
const TranslationForm: React.FC<TranslationFormProps> = ({
  onTranslationComplete,
  initialSourceFormat = DetectionFormat.SPLUNK,
  initialContent = '',
  onError
}) => {
  // State management
  const [content, setContent] = useState(initialContent);
  const [sourceFormat, setSourceFormat] = useState(initialSourceFormat);
  const [targetFormat, setTargetFormat] = useState<DetectionFormat>(DetectionFormat.SIGMA);
  const [validationEnabled, setValidationEnabled] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);

  // Custom hook for translation operations
  const { 
    translateDetection, 
    loading, 
    error: translationError, 
    metrics 
  } = useTranslation();

  // Memoized format options
  const formatOptions = useMemo(() => Object.values(DetectionFormat), []);

  // Debounced content validation
  const validateContent = useMemo(
    () =>
      debounce((value: string) => {
        if (!value.trim()) {
          setContentError('Detection content is required');
        } else if (value.length > 50000) {
          setContentError('Detection content exceeds maximum length (50,000 characters)');
        } else {
          setContentError(null);
        }
      }, 300),
    []
  );

  // Effect for content validation
  useEffect(() => {
    validateContent(content);
    return () => validateContent.cancel();
  }, [content, validateContent]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (contentError || !content.trim()) {
        return;
      }

      try {
        const request: TranslationRequest = {
          sourceFormat,
          targetFormat,
          content,
          validateResult: validationEnabled
        };

        const result = await translateDetection(request);

        if (result.status === TranslationJobStatus.COMPLETED) {
          onTranslationComplete(result, metrics);
        }
      } catch (error) {
        if (error instanceof Error && onError) {
          onError(error);
        }
      }
    },
    [content, sourceFormat, targetFormat, validationEnabled, contentError, translateDetection, metrics, onTranslationComplete, onError]
  );

  return (
    <StyledForm onSubmit={handleSubmit} aria-label="Translation Form">
      <EditorContainer>
        <FormControl fullWidth error={!!contentError}>
          <TextField
            multiline
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            label="Detection Content"
            placeholder="Enter your detection rule here..."
            error={!!contentError}
            disabled={loading}
            inputProps={{
              'aria-label': 'Detection content',
              'aria-describedby': 'content-error-text'
            }}
          />
          {contentError && (
            <FormHelperText id="content-error-text" error>
              {contentError}
            </FormHelperText>
          )}
        </FormControl>

        <Box sx={{ minWidth: 200 }}>
          <FormControl fullWidth margin="normal">
            <Select
              value={sourceFormat}
              onChange={(e) => setSourceFormat(e.target.value as DetectionFormat)}
              label="Source Format"
              disabled={loading}
              inputProps={{
                'aria-label': 'Source detection format'
              }}
            >
              {formatOptions.map((format) => (
                <MenuItem key={format} value={format}>
                  {format}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <Select
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as DetectionFormat)}
              label="Target Format"
              disabled={loading}
              inputProps={{
                'aria-label': 'Target detection format'
              }}
            >
              {formatOptions.map((format) => (
                <MenuItem key={format} value={format}>
                  {format}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </EditorContainer>

      {metrics && (
        <MetricsContainer role="region" aria-label="Translation Metrics">
          <Typography variant="body2">
            Processing Time: {metrics.processingTime}ms
          </Typography>
          <Typography variant="body2">
            Confidence Score: {metrics.confidenceScore}%
          </Typography>
          {metrics.validationDuration > 0 && (
            <Typography variant="body2">
              Validation Time: {metrics.validationDuration}ms
            </Typography>
          )}
        </MetricsContainer>
      )}

      {translationError && (
        <Alert severity="error" aria-live="polite">
          {translationError.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading || !!contentError}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Translating...' : 'Translate Detection'}
        </Button>
      </Box>
    </StyledForm>
  );
};

export default TranslationForm;