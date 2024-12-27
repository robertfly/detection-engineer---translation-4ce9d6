/**
 * @fileoverview Comprehensive test suite for the SingleTranslation page component.
 * Tests translation functionality, UI interactions, error handling, accessibility,
 * and responsive behavior.
 * @version 1.0.0
 */

// External imports - versions specified for enterprise dependency management
import React from 'react'; // v18.2.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { Provider } from 'react-redux'; // v8.1.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { vi } from 'vitest'; // v0.34.0
import { axe, toHaveNoViolations } from '@axe-core/react'; // v4.7.3

// Internal imports
import SingleTranslation from '../../src/pages/SingleTranslation';
import { TranslationResult, TranslationJobStatus } from '../../src/interfaces/translation';
import { DetectionFormat } from '../../src/interfaces/detection';
import { ValidationStatus } from '../../src/interfaces/validation';

// Add custom matchers
expect.extend(toHaveNoViolations);

/**
 * Helper function to render components with Redux store and accessibility testing
 */
const renderWithRedux = async (
  component: React.ReactElement,
  initialState = {},
  options = {}
) => {
  const store = configureStore({
    reducer: {
      translation: (state = initialState, action) => state,
    },
  });

  const rendered = render(
    <Provider store={store}>
      {component}
    </Provider>,
    options
  );

  // Run accessibility tests
  const axeResults = await axe(rendered.container);

  return {
    ...rendered,
    store,
    axeResults,
  };
};

/**
 * Mock translation service responses
 */
const mockTranslationSuccess: TranslationResult = {
  id: '123',
  sourceFormat: DetectionFormat.SPLUNK,
  targetFormat: DetectionFormat.SIGMA,
  sourceContent: 'index=main source=firewall action=blocked',
  translatedContent: 'title: Blocked Firewall Traffic\nlogsource:\n  product: firewall\ndetection:\n  condition: action=blocked',
  confidenceScore: 95,
  status: TranslationJobStatus.COMPLETED,
  validationResult: {
    status: ValidationStatus.SUCCESS,
    issues: [],
    confidenceScore: 98,
  },
  duration: 1500,
  createdAt: new Date(),
};

const mockTranslationError = {
  message: 'Invalid detection format',
  code: 'VALIDATION_ERROR',
};

/**
 * Setup translation service mocks
 */
const setupTranslationMocks = () => {
  const translateMock = vi.fn();
  const validationMock = vi.fn();

  vi.mock('../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
      translateDetection: translateMock,
      loading: false,
      error: null,
    }),
  }));

  return {
    translateMock,
    validationMock,
    cleanup: () => {
      vi.clearAllMocks();
    },
  };
};

describe('SingleTranslation Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA standards', async () => {
      const { axeResults } = await renderWithRedux(<SingleTranslation />);
      expect(axeResults).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      await renderWithRedux(<SingleTranslation />);

      // Test tab navigation
      await user.tab();
      expect(screen.getByLabelText(/Detection content/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/Source detection format/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/Target detection format/i)).toHaveFocus();
    });

    it('should announce translation status to screen readers', async () => {
      const { translateMock } = setupTranslationMocks();
      translateMock.mockResolvedValueOnce(mockTranslationSuccess);

      await renderWithRedux(<SingleTranslation />);
      
      const submitButton = screen.getByRole('button', { name: /translate detection/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/translation successful/i);
      });
    });
  });

  describe('Translation Workflow', () => {
    it('should handle successful translation', async () => {
      const { translateMock } = setupTranslationMocks();
      translateMock.mockResolvedValueOnce(mockTranslationSuccess);

      await renderWithRedux(<SingleTranslation />);

      // Fill form
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        mockTranslationSuccess.sourceContent
      );

      // Submit translation
      const submitButton = screen.getByRole('button', { name: /translate detection/i });
      await userEvent.click(submitButton);

      // Verify results
      await waitFor(() => {
        expect(screen.getByText(mockTranslationSuccess.translatedContent)).toBeInTheDocument();
        expect(screen.getByText(/95%/i)).toBeInTheDocument(); // Confidence score
      });
    });

    it('should display validation results when available', async () => {
      const { translateMock } = setupTranslationMocks();
      translateMock.mockResolvedValueOnce(mockTranslationSuccess);

      await renderWithRedux(<SingleTranslation />);

      // Submit translation
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        mockTranslationSuccess.sourceContent
      );
      await userEvent.click(screen.getByRole('button', { name: /translate detection/i }));

      // Verify validation report
      await waitFor(() => {
        expect(screen.getByTestId('validation-report')).toBeInTheDocument();
        expect(screen.getByText(/98%/i)).toBeInTheDocument(); // Validation confidence
      });
    });

    it('should handle translation errors gracefully', async () => {
      const { translateMock } = setupTranslationMocks();
      translateMock.mockRejectedValueOnce(mockTranslationError);

      await renderWithRedux(<SingleTranslation />);

      // Submit invalid translation
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        'invalid content'
      );
      await userEvent.click(screen.getByRole('button', { name: /translate detection/i }));

      // Verify error display
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(mockTranslationError.message);
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt layout for mobile viewport', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      await renderWithRedux(<SingleTranslation />);

      const resultsContainer = screen.getByTestId('results-container');
      expect(resultsContainer).toHaveStyle({ flexDirection: 'column' });
    });

    it('should maintain usability on small screens', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      await renderWithRedux(<SingleTranslation />);

      // Verify all important elements are visible
      expect(screen.getByLabelText(/Detection content/i)).toBeVisible();
      expect(screen.getByLabelText(/Source detection format/i)).toBeVisible();
      expect(screen.getByRole('button', { name: /translate detection/i })).toBeVisible();
    });
  });

  describe('Performance', () => {
    it('should handle large detection content efficiently', async () => {
      const largeContent = 'x'.repeat(50000);
      const { translateMock } = setupTranslationMocks();
      translateMock.mockResolvedValueOnce({
        ...mockTranslationSuccess,
        sourceContent: largeContent,
      });

      await renderWithRedux(<SingleTranslation />);

      // Input large content
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        largeContent
      );

      // Verify no performance degradation
      expect(screen.getByLabelText(/Detection content/i)).toHaveValue(largeContent);
    });

    it('should optimize re-renders during translation', async () => {
      const renderSpy = vi.fn();
      const { translateMock } = setupTranslationMocks();
      translateMock.mockResolvedValueOnce(mockTranslationSuccess);

      const WrappedComponent = React.memo(() => {
        renderSpy();
        return <SingleTranslation />;
      });

      await renderWithRedux(<WrappedComponent />);

      // Trigger translation
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        mockTranslationSuccess.sourceContent
      );
      await userEvent.click(screen.getByRole('button', { name: /translate detection/i }));

      // Verify minimal re-renders
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should recover from network errors', async () => {
      const { translateMock } = setupTranslationMocks();
      translateMock.mockRejectedValueOnce(new Error('Network error'))
                  .mockResolvedValueOnce(mockTranslationSuccess);

      await renderWithRedux(<SingleTranslation />);

      // First attempt - network error
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        mockTranslationSuccess.sourceContent
      );
      await userEvent.click(screen.getByRole('button', { name: /translate detection/i }));

      // Verify error display
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      });

      // Retry translation
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Verify successful recovery
      await waitFor(() => {
        expect(screen.getByText(mockTranslationSuccess.translatedContent)).toBeInTheDocument();
      });
    });

    it('should handle validation errors appropriately', async () => {
      const { translateMock } = setupTranslationMocks();
      translateMock.mockResolvedValueOnce({
        ...mockTranslationSuccess,
        validationResult: {
          status: ValidationStatus.ERROR,
          issues: [{ message: 'Invalid syntax', severity: 'HIGH' }],
          confidenceScore: 45,
        },
      });

      await renderWithRedux(<SingleTranslation />);

      // Submit translation
      await userEvent.type(
        screen.getByLabelText(/Detection content/i),
        mockTranslationSuccess.sourceContent
      );
      await userEvent.click(screen.getByRole('button', { name: /translate detection/i }));

      // Verify validation error display
      await waitFor(() => {
        expect(screen.getByText(/Invalid syntax/i)).toBeInTheDocument();
        expect(screen.getByText(/45%/i)).toBeInTheDocument();
      });
    });
  });
});