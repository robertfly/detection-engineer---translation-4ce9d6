/**
 * @fileoverview Advanced React component providing a sophisticated code editor for security detection rules.
 * Features Monaco Editor integration, real-time validation, accessibility support, and responsive design.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise deployments
import React, { useCallback, useEffect, useMemo, useState } from 'react'; // v18.2.0
import styled from '@emotion/styled'; // v11.11.0
import { useTheme } from '@mui/material'; // v5.14.0
import { debounce } from 'lodash'; // v4.17.21
import MonacoEditor from '@monaco-editor/react'; // v4.6.0

// Internal imports
import { Detection, DetectionFormat, ValidationResult } from '../../interfaces/detection';
import SyntaxHighlighter from './SyntaxHighlighter';
import { validateDetectionContent } from '../../utils/detection';

/**
 * Props interface for the DetectionEditor component with comprehensive configuration options
 */
interface DetectionEditorProps {
  /** Current detection content */
  content: string;
  /** Detection format for syntax highlighting and validation */
  format: DetectionFormat;
  /** Callback for content changes */
  onChange: (content: string, validation?: ValidationResult) => void;
  /** Optional read-only mode */
  readOnly?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional validation configuration */
  validationOptions?: {
    enableRealTime?: boolean;
    debounceMs?: number;
    strictMode?: boolean;
  };
  /** Optional editor configuration */
  editorOptions?: {
    theme?: 'light' | 'dark';
    fontSize?: number;
    lineNumbers?: boolean;
    minimap?: boolean;
  };
  /** Optional accessibility props */
  a11yProps?: {
    'aria-label'?: string;
    'aria-describedby'?: string;
  };
}

/**
 * Styled container component with responsive design and theme integration
 */
const EditorContainer = styled.div<{ readOnly?: boolean }>`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  background-color: ${({ theme }) => theme.palette.background.paper};
  min-height: 300px;
  position: relative;
  overflow: hidden;

  ${({ readOnly, theme }) => readOnly && `
    background-color: ${theme.palette.action.disabledBackground};
    cursor: not-allowed;
  `}

  @media (max-width: ${({ theme }) => theme.breakpoints.values.sm}px) {
    min-height: 200px;
  }

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }

  @media (prefers-contrast: high) {
    border-width: 2px;
  }
`;

/**
 * Styled validation feedback component with accessibility support
 */
const ValidationFeedback = styled.div<{ severity: 'error' | 'warning' | 'success' }>`
  padding: ${({ theme }) => theme.spacing(1)};
  border-top: 1px solid ${({ theme }) => theme.palette.divider};
  color: ${({ theme, severity }) => 
    severity === 'error' ? theme.palette.error.main :
    severity === 'warning' ? theme.palette.warning.main :
    theme.palette.success.main
  };
  font-size: 0.875rem;
  transition: all 0.3s ease;
  
  &[role="alert"] {
    animation: fadeIn 0.3s ease;
  }
`;

/**
 * DetectionEditor component providing advanced code editing capabilities
 */
const DetectionEditor: React.FC<DetectionEditorProps> = ({
  content,
  format,
  onChange,
  readOnly = false,
  className,
  validationOptions = {
    enableRealTime: true,
    debounceMs: 500,
    strictMode: true,
  },
  editorOptions = {
    theme: 'light',
    fontSize: 14,
    lineNumbers: true,
    minimap: true,
  },
  a11yProps = {
    'aria-label': 'Detection code editor',
  },
}) => {
  // Theme and state management
  const theme = useTheme();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Memoized editor options
  const monacoOptions = useMemo(() => ({
    readOnly,
    fontSize: editorOptions.fontSize,
    lineNumbers: editorOptions.lineNumbers ? 'on' : 'off',
    minimap: { enabled: editorOptions.minimap },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    renderWhitespace: 'boundary',
    folding: true,
    tabSize: 2,
    'semanticHighlighting.enabled': true,
    'bracketPairColorization.enabled': true,
  }), [editorOptions, readOnly]);

  // Debounced content validation
  const debouncedValidation = useCallback(
    debounce(async (newContent: string) => {
      if (!validationOptions.enableRealTime) return;

      const validationResult = validateDetectionContent(
        newContent,
        format,
        { strictMode: validationOptions.strictMode }
      );

      setValidation(validationResult);
      onChange(newContent, validationResult);
    }, validationOptions.debounceMs),
    [format, onChange, validationOptions]
  );

  // Handle content changes
  const handleContentChange = useCallback((newContent: string | undefined) => {
    if (readOnly || !newContent) return;
    debouncedValidation(newContent);
  }, [readOnly, debouncedValidation]);

  // Editor initialization handler
  const handleEditorDidMount = useCallback(() => {
    setIsEditorReady(true);
  }, []);

  // Initial validation on mount
  useEffect(() => {
    if (content && validationOptions.enableRealTime) {
      debouncedValidation(content);
    }
  }, [content, validationOptions.enableRealTime, debouncedValidation]);

  return (
    <EditorContainer 
      className={className}
      readOnly={readOnly}
      {...a11yProps}
    >
      <MonacoEditor
        height="300px"
        language={format.toLowerCase()}
        value={content}
        onChange={handleContentChange}
        options={monacoOptions}
        theme={editorOptions.theme === 'dark' ? 'vs-dark' : 'vs-light'}
        onMount={handleEditorDidMount}
        loading={<SyntaxHighlighter content={content} format={format} />}
      />
      
      {validation && validationOptions.enableRealTime && (
        <ValidationFeedback
          severity={
            validation.errors.length > 0 ? 'error' :
            validation.details.length > 0 ? 'warning' : 'success'
          }
          role="alert"
          aria-live="polite"
        >
          {validation.errors.length > 0 ? (
            <>Error: {validation.errors[0]}</>
          ) : validation.details.length > 0 ? (
            <>Warning: {validation.details[0].message}</>
          ) : (
            <>Valid {format} detection</>
          )}
        </ValidationFeedback>
      )}
    </EditorContainer>
  );
};

// Export with memo for performance optimization
export default React.memo(DetectionEditor, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content &&
         prevProps.format === nextProps.format &&
         prevProps.readOnly === nextProps.readOnly;
});