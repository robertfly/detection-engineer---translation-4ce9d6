/**
 * @fileoverview React component that provides an accessible, responsive side-by-side comparison
 * of source and translated detection content with syntax highlighting and performance optimizations.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise dependency management
import React from 'react'; // v18.2.0
import styled from '@emotion/styled'; // v11.11.0
import { useTheme, Box, Typography, useMediaQuery } from '@mui/material'; // v5.14.0

// Internal imports
import SyntaxHighlighter from '../detection/SyntaxHighlighter';
import { TranslationResult } from '../../interfaces/translation';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for TranslationDiff component with accessibility and performance options
 */
interface TranslationDiffProps {
  /** Translation result containing source and target content */
  translationResult: TranslationResult;
  /** Toggle line number display in code views */
  showLineNumbers?: boolean;
  /** Custom CSS class for styling */
  className?: string;
  /** Enable virtualization for large content */
  virtualize?: boolean;
  /** Maximum height for the diff panels */
  maxHeight?: number;
  /** Error handler callback */
  onError?: (error: Error) => void;
}

/**
 * Styled container for the diff view with responsive layout
 */
const DiffContainer = styled(Box)<{ isDesktop: boolean }>`
  display: flex;
  flex-direction: ${({ isDesktop }) => isDesktop ? 'row' : 'column'};
  gap: ${({ theme }) => theme.spacing(2)};
  height: 100%;
  min-height: ${({ isDesktop }) => isDesktop ? '400px' : '200px'};
  width: 100%;
  position: relative;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

/**
 * Styled container for each diff panel with accessibility enhancements
 */
const DiffPanel = styled(Box)`
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  overflow: hidden;
  
  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
  }
`;

/**
 * Styled header for each diff panel
 */
const DiffHeader = styled(Box)`
  padding: ${({ theme }) => theme.spacing(1, 2)};
  background: ${({ theme }) => theme.palette.background.default};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

/**
 * Styled content area for each diff panel with performance optimizations
 */
const DiffContent = styled(Box)<{ maxHeight?: number }>`
  flex: 1;
  overflow: auto;
  background: ${({ theme }) => theme.palette.background.paper};
  position: relative;
  max-height: ${({ maxHeight }) => maxHeight ? `${maxHeight}px` : '100%'};
  -webkit-overflow-scrolling: touch;
`;

/**
 * TranslationDiff component for rendering side-by-side comparison of detections
 * Implements accessibility features and performance optimizations
 */
const TranslationDiff: React.FC<TranslationDiffProps> = React.memo(({
  translationResult,
  showLineNumbers = true,
  className,
  virtualize = false,
  maxHeight,
  onError
}) => {
  // Theme and responsive layout hooks
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Memoize panel configurations for performance
  const panelConfigs = React.useMemo(() => [
    {
      format: translationResult.sourceFormat,
      content: translationResult.sourceContent,
      label: 'Source Detection'
    },
    {
      format: translationResult.targetFormat,
      content: translationResult.translatedContent,
      label: 'Translated Detection'
    }
  ], [translationResult]);

  // Error handler for ErrorBoundary
  const handleError = React.useCallback((error: Error) => {
    console.error('TranslationDiff error:', error);
    onError?.(error);
  }, [onError]);

  return (
    <ErrorBoundary onError={handleError}>
      <DiffContainer 
        isDesktop={isDesktop}
        className={className}
        role="region"
        aria-label="Detection Translation Comparison"
      >
        {panelConfigs.map(({ format, content, label }, index) => (
          <DiffPanel
            key={format}
            role="region"
            aria-label={label}
            tabIndex={0}
          >
            <DiffHeader>
              <Typography variant="subtitle2" component="h3">
                {label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {format}
              </Typography>
            </DiffHeader>
            <DiffContent maxHeight={maxHeight}>
              <SyntaxHighlighter
                content={content}
                format={format}
                showLineNumbers={showLineNumbers}
                virtualize={virtualize && content.length > 1000}
              />
            </DiffContent>
          </DiffPanel>
        ))}
      </DiffContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
TranslationDiff.displayName = 'TranslationDiff';

export default TranslationDiff;