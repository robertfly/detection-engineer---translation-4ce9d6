/**
 * @fileoverview BatchTranslation page component implementing batch translation interface
 * with comprehensive progress tracking, results display, and accessibility support.
 * @version 1.0.0
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Container, Box, Typography, Alert } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0

// Internal imports
import BatchUpload from '../components/translation/BatchUpload';
import BatchProgress from '../components/translation/BatchProgress';
import ResultsGrid from '../components/translation/ResultsGrid';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useTranslation } from '../hooks/useTranslation';
import { logger } from '../utils/logger';
import { APP_CONFIG } from '../config/constants';

// Types
import { TranslationResult, BatchTranslationStatus, TranslationJobStatus } from '../interfaces/translation';
import { DetectionFormat } from '../interfaces/detection';

// Styled components with accessibility enhancements
const PageContainer = styled(Container)(({ theme }) => ({
  maxWidth: '1200px',
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
  position: 'relative',
  '& > *:not(:last-child)': {
    marginBottom: theme.spacing(3)
  }
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '& > *:not(:last-child)': {
    marginBottom: theme.spacing(2)
  }
}));

const ResultsSection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4)
}));

/**
 * BatchTranslation page component that implements the batch translation interface
 * with comprehensive progress tracking and results display.
 */
const BatchTranslation: React.FC = () => {
  // State management
  const [batchStatus, setBatchStatus] = useState<BatchTranslationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TranslationResult[]>([]);

  // Custom hooks
  const { translateBatch, progress, abort } = useTranslation();

  // Effect for cleanup on unmount
  useEffect(() => {
    return () => {
      abort(); // Cancel any ongoing translations
      logger.info('BatchTranslation component unmounted, cleanup complete');
    };
  }, [abort]);

  /**
   * Handle batch upload completion with validation and error handling
   */
  const handleUploadComplete = useCallback(async (files: File[]) => {
    try {
      logger.info('Starting batch translation', { fileCount: files.length });
      
      // Reset state
      setError(null);
      setResults([]);
      setBatchStatus(null);

      // Start batch translation
      const response = await translateBatch({
        files,
        targetFormat: DetectionFormat.SIGMA,
        validateResults: true
      });

      setBatchStatus(response);
      logger.info('Batch translation completed', { 
        jobId: response.jobId,
        successCount: response.successfulTranslations
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process batch translation';
      setError(errorMessage);
      logger.error('Batch translation failed', { error: err });
    }
  }, [translateBatch]);

  /**
   * Handle batch translation errors with user feedback
   */
  const handleError = useCallback((error: Error) => {
    setError(error.message);
    logger.error('Batch translation error', { error });
  }, []);

  /**
   * Handle viewing a specific translation result
   */
  const handleViewResult = useCallback(async (id: string) => {
    try {
      // Implementation for viewing result details
      logger.info('Viewing translation result', { resultId: id });
    } catch (err) {
      logger.error('Error viewing result', { error: err, resultId: id });
    }
  }, []);

  /**
   * Handle downloading translation results
   */
  const handleDownload = useCallback(async (id: string) => {
    try {
      // Implementation for downloading results
      logger.info('Downloading translation result', { resultId: id });
    } catch (err) {
      logger.error('Error downloading result', { error: err, resultId: id });
    }
  }, []);

  return (
    <ErrorBoundary>
      <PageContainer 
        component="main"
        role="main"
        aria-label="Batch Translation Interface"
      >
        <HeaderSection>
          <Typography 
            variant="h4" 
            component="h1"
            gutterBottom
          >
            Batch Translation
          </Typography>
          
          <Typography 
            variant="body1" 
            color="textSecondary"
            paragraph
          >
            Upload multiple detection files for batch translation. Supported formats include
            Splunk SPL, QRadar AQL, and other major SIEM platforms.
          </Typography>
        </HeaderSection>

        {error && (
          <Alert 
            severity="error"
            onClose={() => setError(null)}
            role="alert"
          >
            {error}
          </Alert>
        )}

        <BatchUpload
          targetFormat={DetectionFormat.SIGMA}
          onUploadComplete={handleUploadComplete}
          onError={handleError}
          onProgress={(progress) => logger.debug('Upload progress', { progress })}
          onCancel={() => abort()}
          ariaLabel="Upload detection files for batch translation"
        />

        {batchStatus && (
          <BatchProgress
            status={batchStatus}
            aria-label="Batch translation progress"
          />
        )}

        {results.length > 0 && (
          <ResultsSection
            role="region"
            aria-label="Translation Results"
          >
            <Typography 
              variant="h5" 
              component="h2"
              gutterBottom
            >
              Translation Results
            </Typography>

            <ResultsGrid
              results={results}
              batchStatus={batchStatus!}
              onViewResult={handleViewResult}
              onDownload={handleDownload}
              onViewReport={handleViewResult}
              loading={progress?.status === TranslationJobStatus.PROCESSING}
              error={error ? new Error(error) : null}
              aria-label="Translation results grid"
            />
          </ResultsSection>
        )}
      </PageContainer>
    </ErrorBoundary>
  );
};

export default BatchTranslation;