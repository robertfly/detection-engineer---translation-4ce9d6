/**
 * @fileoverview React component for syntax highlighting detection content across different SIEM formats.
 * Provides enterprise-grade code display with accessibility features and performance optimizations.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise dependency management
import React from 'react'; // v18.2.0
import styled from '@emotion/styled'; // v11.11.0
import { useTheme } from '@mui/material'; // v5.14.0

// Internal imports
import { DetectionFormat } from '../../interfaces/detection';
import { formatDetectionContent } from '../../utils/format';

/**
 * Props interface for the SyntaxHighlighter component with strict validation requirements
 */
interface SyntaxHighlighterProps {
  /** Detection content to be highlighted - required, must not be empty */
  content: string;
  /** Format of the detection content - must be valid DetectionFormat enum value */
  format: DetectionFormat;
  /** Toggle line number display - optional with default true */
  showLineNumbers?: boolean;
  /** Custom CSS class for styling - optional */
  className?: string;
}

/**
 * Styled container component with responsive design and theme integration
 */
const Container = styled.div`
  display: flex;
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  padding: ${({ theme }) => theme.spacing(2)};
  font-family: 'Fira Code', monospace;
  overflow: hidden;
  position: relative;
  
  @media (max-width: 600px) {
    padding: ${({ theme }) => theme.spacing(1)};
  }
`;

/**
 * Styled line number container with accessibility enhancements
 */
const LineNumbers = styled.div`
  border-right: 1px solid ${({ theme }) => theme.palette.divider};
  padding-right: ${({ theme }) => theme.spacing(2)};
  margin-right: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.palette.text.secondary};
  user-select: none;
  min-width: 3rem;
  text-align: right;
  aria-hidden: true;
  font-variant-numeric: tabular-nums;
`;

/**
 * Styled content container with responsive font sizing and performance optimizations
 */
const Content = styled.div`
  flex: 1;
  overflow-x: auto;
  white-space: pre;
  font-size: ${({ theme }) => theme.typography.body2.fontSize};
  tab-size: 4;
  -webkit-font-smoothing: antialiased;
  
  @media (max-width: 600px) {
    font-size: 12px;
  }

  /* Optimize performance for large content */
  @media screen and (min-width: 1024px) {
    contain: content;
    will-change: transform;
  }
`;

/**
 * Memoized function to generate line numbers with accessibility support
 */
const getLineNumbers = React.useMemo(() => (content: string): string => {
  if (!content) return '';
  
  const lineCount = content.split('\n').length;
  const digits = lineCount.toString().length;
  
  return Array.from({ length: lineCount }, (_, i) => i + 1)
    .map(num => `<span aria-label="Line ${num}" role="presentation">${num.toString().padStart(digits, ' ')}</span>`)
    .join('\n');
}, []);

/**
 * SyntaxHighlighter component for rendering detection content with syntax highlighting
 * Implements performance optimizations and accessibility features
 */
const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  content,
  format,
  showLineNumbers = true,
  className
}) => {
  // Access theme context for styled components
  const theme = useTheme();

  // Memoize highlighted content to prevent unnecessary re-renders
  const highlightedContent = React.useMemo(() => {
    try {
      return formatDetectionContent(content, format);
    } catch (error) {
      console.error('Error highlighting detection content:', error);
      return content;
    }
  }, [content, format]);

  // Memoize line numbers for performance
  const lineNumbersHtml = React.useMemo(() => {
    return showLineNumbers ? getLineNumbers(content) : '';
  }, [content, showLineNumbers, getLineNumbers]);

  return (
    <Container className={className} role="region" aria-label="Detection Code">
      {showLineNumbers && (
        <LineNumbers
          dangerouslySetInnerHTML={{ __html: lineNumbersHtml }}
          role="presentation"
        />
      )}
      <Content
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
        role="code"
        aria-label={`${format} detection code`}
        tabIndex={0}
      />
    </Container>
  );
};

// Performance optimization with React.memo
export default React.memo(SyntaxHighlighter, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content &&
         prevProps.format === nextProps.format &&
         prevProps.showLineNumbers === nextProps.showLineNumbers;
});