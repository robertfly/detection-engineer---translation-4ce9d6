/**
 * @fileoverview Comprehensive test suite for the DetectionEditor component
 * Tests detection editing capabilities, syntax highlighting, validation, and accessibility
 * @version 1.0.0
 */

// External imports - versions specified for enterprise deployments
import React from 'react'; // v18.2.0
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { ThemeProvider, createTheme } from '@mui/material'; // v5.14.0
import { describe, expect, it, jest, beforeEach } from '@jest/globals'; // v29.6.0

// Internal imports
import DetectionEditor from '../../../src/components/detection/DetectionEditor';
import { DetectionFormat } from '../../../src/interfaces/detection';
import { validateDetectionContent } from '../../../src/utils/detection';

// Mock dependencies
jest.mock('@monaco-editor/react', () => {
  return jest.fn(({ value, onChange, options }) => (
    <div data-testid="monaco-editor" role="textbox">
      <textarea 
        value={value} 
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={options?.readOnly}
      />
    </div>
  ));
});

jest.mock('../../../src/utils/detection', () => ({
  validateDetectionContent: jest.fn()
}));

// Test data constants
const detectionSamples = {
  [DetectionFormat.SPLUNK]: 'index=main sourcetype=windows EventCode=4625',
  [DetectionFormat.SIGMA]: 'title: Failed Windows Logon\nstatus: test\nlogsource:\n  product: windows\n  service: security',
  [DetectionFormat.KQL]: 'SecurityEvent | where EventID == 4625',
  [DetectionFormat.YARA]: 'rule suspicious_behavior { condition: true }'
};

const validationResults = {
  valid: {
    isValid: true,
    errors: [],
    details: [],
    severity: 'INFO',
    confidence: 1.0
  },
  invalid: {
    isValid: false,
    errors: ['Invalid syntax'],
    details: [{ message: 'Syntax error', location: 'line 1', suggestion: 'Fix syntax', severity: 'ERROR' }],
    severity: 'ERROR',
    confidence: 0.5
  }
};

// Helper function to render component with theme
const renderWithTheme = (ui: React.ReactNode, options = {}) => {
  const theme = createTheme({
    palette: {
      mode: 'light'
    }
  });

  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>,
    options
  );
};

describe('DetectionEditor Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (validateDetectionContent as jest.Mock).mockReset();
  });

  describe('Rendering', () => {
    it('renders editor with initial content', () => {
      const content = detectionSamples[DetectionFormat.SPLUNK];
      renderWithTheme(
        <DetectionEditor
          content={content}
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue(content);
    });

    it('applies correct theme based on editorOptions', () => {
      renderWithTheme(
        <DetectionEditor
          content=""
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
          editorOptions={{ theme: 'dark' }}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toHaveAttribute('data-theme', 'vs-dark');
    });

    it('handles read-only mode correctly', () => {
      renderWithTheme(
        <DetectionEditor
          content={detectionSamples[DetectionFormat.SPLUNK]}
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
          readOnly={true}
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('readonly');
    });
  });

  describe('Format Support', () => {
    Object.values(DetectionFormat).forEach(format => {
      it(`supports ${format} format with correct syntax highlighting`, () => {
        const content = detectionSamples[format] || '';
        renderWithTheme(
          <DetectionEditor
            content={content}
            format={format}
            onChange={jest.fn()}
          />
        );

        const editor = screen.getByTestId('monaco-editor');
        expect(editor).toHaveAttribute('data-language', format.toLowerCase());
      });
    });
  });

  describe('Validation', () => {
    it('validates content on change with debounce', async () => {
      const onChange = jest.fn();
      (validateDetectionContent as jest.Mock).mockResolvedValue(validationResults.valid);

      renderWithTheme(
        <DetectionEditor
          content=""
          format={DetectionFormat.SPLUNK}
          onChange={onChange}
          validationOptions={{ enableRealTime: true, debounceMs: 100 }}
        />
      );

      const editor = screen.getByRole('textbox');
      await userEvent.type(editor, 'index=main');

      await waitFor(() => {
        expect(validateDetectionContent).toHaveBeenCalledWith(
          'index=main',
          DetectionFormat.SPLUNK,
          expect.any(Object)
        );
      }, { timeout: 200 });
    });

    it('displays validation feedback for errors', async () => {
      (validateDetectionContent as jest.Mock).mockResolvedValue(validationResults.invalid);

      renderWithTheme(
        <DetectionEditor
          content="invalid content"
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
          validationOptions={{ enableRealTime: true }}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Error: Invalid syntax');
      });
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      renderWithTheme(
        <DetectionEditor
          content={detectionSamples[DetectionFormat.SPLUNK]}
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveFocus();

      await userEvent.tab();
      expect(document.activeElement).toBeTruthy();
    });

    it('provides appropriate ARIA labels', () => {
      renderWithTheme(
        <DetectionEditor
          content=""
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
          a11yProps={{ 'aria-label': 'Custom editor label' }}
        />
      );

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Custom editor label');
    });

    it('announces validation status to screen readers', async () => {
      (validateDetectionContent as jest.Mock).mockResolvedValue(validationResults.invalid);

      renderWithTheme(
        <DetectionEditor
          content="invalid content"
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
          validationOptions={{ enableRealTime: true }}
        />
      );

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to container size changes', async () => {
      const { container } = renderWithTheme(
        <DetectionEditor
          content=""
          format={DetectionFormat.SPLUNK}
          onChange={jest.fn()}
        />
      );

      const editor = container.querySelector('.editor-container');
      expect(editor).toHaveStyle({ minHeight: '300px' });
    });
  });
});