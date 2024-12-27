/**
 * @fileoverview Page component for single detection translation with comprehensive
 * accessibility support, real-time validation, and performance optimizations.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise dependency management
import React, { useState, useCallback, memo } from 'react'; // v18.2.0
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0

// Internal imports
import TranslationForm from '../components/translation/TranslationForm';
import ValidationReport from '../components/translation/ValidationReport';
import TranslationDiff from '../components/translation/TranslationDiff';
import { useTranslation } from '../hooks/useTranslation';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { TranslationResult } from '../interfaces/translation';
import { ValidationResult } from '../interfaces/validation';

/**
 * Interface for managing translation state and validation results
 */
interface TranslationState {
  translationResult: TranslationResult | null;
  validationResult: ValidationResult | null;
  showValidationReport: boolean;
  error: string | null;
}

/**
 * Styled container for the page layout with accessibility considerations
 */
const PageContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  height: '100%',
  minHeight: 0,
  overflow: 'auto',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

/**
 * Styled container for translation results with responsive layout
 */
const ResultsContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minHeight: 0,
  '@media (min-width: 768px)': {
    flexDirection: 'row',
  },
}));

/**
 * SingleTranslation page component for handling individual detection translations
 * Implements comprehensive error handling and accessibility features
 */
const SingleTranslation: React.FC = memo(() => {
  // Translation state management
  const [state, setState] = useState<TranslationState>({
    translationResult: null,
    validationResult: null,
    showValidationReport: false,
    error: null,
  });

  // Get translation functions and state from hook
  const { translateDetection, loading, error: translationError } = useTranslation();

  /**
   * Handles successful translation completion with validation
   */
  const handleTranslationComplete = useCallback((result: TranslationResult) => {
    setState((prev) => ({
      ...prev,
      translationResult: result,
      validationResult: result.validationResult || null,
      showValidationReport: !!result.validationResult,
      error: null,
    }));
  }, []);

  /**
   * Handles closing of validation report with focus management
   */
  const handleValidationClose = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showValidationReport: false,
    }));
  }, []);

  /**
   * Handles validation report export
   */
  const handleExportReport = useCallback(() => {
    if (state.validationResult) {
      const reportData = JSON.stringify(state.validationResult, null, 2);
      const blob = new Blob([reportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `validation-report-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [state.validationResult]);

  /**
   * Error handler for ErrorBoundary
   */
  const handleError = useCallback((error: Error) => {
    setState((prev) => ({
      ...prev,
      error: error.message,
    }));
  }, []);

  return (
    <ErrorBoundary onError={handleError}>
      <PageContainer maxWidth="xl" component="main" role="main">
        <Typography variant="h4" component="h1" gutterBottom>
          Single Detection Translation
        </Typography>

        <Paper elevation={0} sx={{ p: 3 }}>
          <TranslationForm
            onTranslationComplete={handleTranslationComplete}
            onError={handleError}
          />
        </Paper>

        {loading && (
          <Box
            display="flex"
            justifyContent="center"
            p={3}
            role="status"
            aria-label="Translation in progress"
          >
            <CircularProgress size={40} />
          </Box>
        )}

        {(translationError || state.error) && (
          <Alert
            severity="error"
            aria-live="polite"
            sx={{ mb: 2 }}
          >
            {translationError || state.error}
          </Alert>
        )}

        {state.translationResult && (
          <ResultsContainer>
            <Box flex={1} minHeight={0}>
              <TranslationDiff
                translationResult={state.translationResult}
                showLineNumbers
                virtualize
              />
            </Box>

            {state.showValidationReport && state.validationResult && (
              <Box width={{ xs: '100%', md: '400px' }}>
                <ValidationReport
                  validationResult={state.validationResult}
                  onClose={handleValidationClose}
                  onExport={handleExportReport}
                />
              </Box>
            )}
          </ResultsContainer>
        )}
      </PageContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
SingleTranslation.displayName = 'SingleTranslation';

export default SingleTranslation;