/**
 * @fileoverview Comprehensive test suite for TranslationForm component
 * @version 1.0.0
 */

// External imports - versions from technical specification
import React from 'react'; // v18.2.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { Provider } from 'react-redux'; // v8.1.0
import { configureAxe, toHaveNoViolations } from 'jest-axe'; // v4.7.0
import { act } from 'react-dom/test-utils'; // v18.2.0

// Internal imports
import TranslationForm from '../../../src/components/translation/TranslationForm';
import { DetectionFormat } from '../../../src/interfaces/detection';
import { TranslationJobStatus } from '../../../src/interfaces/translation';
import { ValidationStatus } from '../../../src/interfaces/validation';
import { createTestStore } from '../../../src/store/testUtils';

// Configure jest-axe
expect.extend(toHaveNoViolations);
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: true },
    'label': { enabled: true },
    'aria-roles': { enabled: true }
  }
});

// Mock the translation hook
jest.mock('../../../src/hooks/useTranslation', () => ({
  useTranslation: jest.fn()
}));

// Test utilities
const mockTranslationHook = {
  translateDetection: jest.fn(),
  loading: false,
  error: null,
  metrics: {
    processingTime: 500,
    confidenceScore: 98,
    validationDuration: 200,
    totalDuration: 700
  }
};

const renderWithProvider = (ui: React.ReactElement, { store = createTestStore() } = {}) => {
  return {
    ...render(
      <Provider store={store}>
        {ui}
      </Provider>
    ),
    store
  };
};

describe('TranslationForm', () => {
  let mockOnTranslationComplete: jest.Mock;
  let mockOnError: jest.Mock;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTranslationComplete = jest.fn();
    mockOnError = jest.fn();
    user = userEvent.setup();
    require('../../../src/hooks/useTranslation').useTranslation.mockReturnValue(mockTranslationHook);
  });

  describe('Rendering', () => {
    it('should render all form elements correctly', () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByLabelText(/detection content/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/source detection format/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/target detection format/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /translate detection/i })).toBeInTheDocument();
    });

    it('should initialize with default values', () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByLabelText(/source detection format/i)).toHaveValue(DetectionFormat.SPLUNK);
      expect(screen.getByLabelText(/target detection format/i)).toHaveValue(DetectionFormat.SIGMA);
      expect(screen.getByLabelText(/detection content/i)).toHaveValue('');
    });

    it('should render with provided initial values', () => {
      const initialContent = 'test detection';
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          initialContent={initialContent}
          initialSourceFormat={DetectionFormat.KQL}
          onError={mockOnError}
        />
      );

      expect(screen.getByLabelText(/detection content/i)).toHaveValue(initialContent);
      expect(screen.getByLabelText(/source detection format/i)).toHaveValue(DetectionFormat.KQL);
    });
  });

  describe('User Interactions', () => {
    it('should handle content input changes', async () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      const input = screen.getByLabelText(/detection content/i);
      await user.type(input, 'test detection content');
      expect(input).toHaveValue('test detection content');
    });

    it('should handle format selection changes', async () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      const sourceSelect = screen.getByLabelText(/source detection format/i);
      const targetSelect = screen.getByLabelText(/target detection format/i);

      await user.click(sourceSelect);
      await user.click(screen.getByText(DetectionFormat.KQL));
      expect(sourceSelect).toHaveValue(DetectionFormat.KQL);

      await user.click(targetSelect);
      await user.click(screen.getByText(DetectionFormat.YARA));
      expect(targetSelect).toHaveValue(DetectionFormat.YARA);
    });

    it('should handle form submission', async () => {
      const testContent = 'test detection';
      mockTranslationHook.translateDetection.mockResolvedValueOnce({
        status: TranslationJobStatus.COMPLETED,
        translatedContent: 'translated content'
      });

      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      await user.type(screen.getByLabelText(/detection content/i), testContent);
      await user.click(screen.getByRole('button', { name: /translate detection/i }));

      expect(mockTranslationHook.translateDetection).toHaveBeenCalledWith({
        sourceFormat: DetectionFormat.SPLUNK,
        targetFormat: DetectionFormat.SIGMA,
        content: testContent,
        validateResult: true
      });
    });
  });

  describe('Validation', () => {
    it('should show error for empty content', async () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      const submitButton = screen.getByRole('button', { name: /translate detection/i });
      await user.click(submitButton);

      expect(screen.getByText(/detection content is required/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should show error for content exceeding maximum length', async () => {
      const longContent = 'a'.repeat(51000);
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      await user.type(screen.getByLabelText(/detection content/i), longContent);
      expect(screen.getByText(/detection content exceeds maximum length/i)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during translation', async () => {
      mockTranslationHook.loading = true;
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByRole('button', { name: /translating/i })).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle translation errors', async () => {
      const errorMessage = 'Translation failed';
      mockTranslationHook.translateDetection.mockRejectedValueOnce(new Error(errorMessage));

      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      await user.type(screen.getByLabelText(/detection content/i), 'test');
      await user.click(screen.getByRole('button', { name: /translate detection/i }));

      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      await user.tab();
      expect(screen.getByLabelText(/detection content/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/source detection format/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/target detection format/i)).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should render metrics when available', async () => {
      renderWithProvider(
        <TranslationForm 
          onTranslationComplete={mockOnTranslationComplete}
          onError={mockOnError}
        />
      );

      const metricsRegion = screen.getByRole('region', { name: /translation metrics/i });
      expect(within(metricsRegion).getByText(/processing time: 500ms/i)).toBeInTheDocument();
      expect(within(metricsRegion).getByText(/confidence score: 98%/i)).toBeInTheDocument();
    });
  });
});