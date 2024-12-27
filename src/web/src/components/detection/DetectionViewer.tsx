/**
 * @fileoverview A React component that provides an accessible, performant, and theme-aware viewer 
 * for security detection rules. Implements Material Design 3.0 and WCAG 2.1 Level AA standards.
 * @version 1.0.0
 */

import React, { memo, useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { useTheme, useMediaQuery } from '@mui/material';
import { useVirtual } from 'react-virtual';

// Internal imports
import SyntaxHighlighter from './SyntaxHighlighter';
import Card from '../common/Card';
import { Detection, DetectionFormat } from '../../interfaces/detection';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for DetectionViewer component with comprehensive type safety
 */
interface DetectionViewerProps {
  /** Detection object containing content and metadata */
  detection: Detection;
  /** Toggle line numbers display */
  showLineNumbers?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Read-only mode flag */
  isReadOnly?: boolean;
  /** Callback for content changes */
  onContentChange?: (content: string) => void;
  /** High contrast mode flag for accessibility */
  isHighContrastMode?: boolean;
  /** Reduced motion flag for accessibility */
  reduceMotion?: boolean;
}

/**
 * Styled container with accessibility and responsive design support
 */
const ViewerContainer = styled(Card)<{ reduceMotion?: boolean }>`
  width: 100%;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
  position: relative;
  
  ${({ theme }) => `
    border-radius: ${theme.shape.borderRadius}px;
    background-color: ${theme.palette.background.paper};
  `}

  @media (max-width: 600px) {
    min-height: 150px;
  }

  ${({ reduceMotion }) => reduceMotion && `
    @media (prefers-reduced-motion: reduce) {
      transition: none !important;
    }
  `}

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

/**
 * Styled header with proper contrast and spacing
 */
const ViewerHeader = styled.div<{ isHighContrast?: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;

  ${({ theme, isHighContrast }) => isHighContrast && `
    background-color: ${theme.palette.background.default};
    @media (forced-colors: active) {
      border-bottom: 2px solid ButtonText;
    }
  `}

  @media (max-width: 600px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing(1)};
  }
`;

/**
 * Styled content area with virtualization support
 */
const ViewerContent = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  height: calc(100% - 64px);
  overflow: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.palette.primary.main} transparent`};
`;

/**
 * Format timestamp with locale support
 */
const formatTimestamp = (timestamp: Date): string => {
  return new Intl.DateTimeFormat(navigator.language, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(timestamp);
};

/**
 * DetectionViewer component with accessibility and performance optimizations
 */
const DetectionViewer: React.FC<DetectionViewerProps> = memo(({
  detection,
  showLineNumbers = true,
  className,
  isReadOnly = false,
  onContentChange,
  isHighContrastMode = false,
  reduceMotion = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Set up virtualization for large content
  const parentRef = React.useRef<HTMLDivElement>(null);
  const lines = useMemo(() => detection.content.split('\n'), [detection.content]);
  
  const rowVirtualizer = useVirtual({
    size: lines.length,
    parentRef,
    estimateSize: useCallback(() => 24, []),
    overscan: 5
  });

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    if (!isReadOnly && onContentChange) {
      onContentChange(newContent);
    }
  }, [isReadOnly, onContentChange]);

  // Update virtual list on content changes
  useEffect(() => {
    rowVirtualizer.measure();
  }, [detection.content, rowVirtualizer]);

  return (
    <ErrorBoundary>
      <ViewerContainer 
        className={className}
        reduceMotion={reduceMotion}
        role="region"
        aria-label={`Detection viewer for ${detection.metadata.name}`}
      >
        <ViewerHeader isHighContrast={isHighContrastMode}>
          <div>
            <span role="heading" aria-level={2}>
              {detection.metadata.name}
            </span>
            <span aria-label="Detection format" role="text">
              {` - ${detection.format}`}
            </span>
          </div>
          <div aria-label="Last modified">
            {formatTimestamp(detection.created_at)}
          </div>
        </ViewerHeader>

        <ViewerContent ref={parentRef}>
          <SyntaxHighlighter
            content={detection.content}
            format={detection.format}
            showLineNumbers={showLineNumbers && !isMobile}
            aria-readonly={isReadOnly}
            onChange={handleContentChange}
          />
        </ViewerContent>
      </ViewerContainer>
    </ErrorBoundary>
  );
});

DetectionViewer.displayName = 'DetectionViewer';

export default DetectionViewer;