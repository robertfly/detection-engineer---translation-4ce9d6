import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

// Component imports
import BatchTranslation from '../../src/pages/BatchTranslation';
import { useTranslation } from '../../src/hooks/useTranslation';
import { DetectionFormat } from '../../src/interfaces/detection';
import { TranslationJobStatus } from '../../src/interfaces/translation';

// Mock the translation hook
vi.mock('../../src/hooks/useTranslation', () => ({
  useTranslation: vi.fn()
}));

// Configure jest-axe
expect.extend(toHaveNoViolations);

// Mock data
const mockFiles = [
  new File(['detection1'], 'test1.spl', { type: 'text/plain' }),
  new File(['detection2'], 'test2.spl', { type: 'text/plain' })
];

const mockTranslationResults = [
  {
    id: '1',
    sourceFormat: DetectionFormat.SPLUNK,
    targetFormat: DetectionFormat.SIGMA,
    sourceContent: 'source1',
    translatedContent: 'translated1',
    confidenceScore: 98,
    status: TranslationJobStatus.COMPLETED,
    duration: 1500,
    createdAt: new Date()
  },
  {
    id: '2',
    sourceFormat: DetectionFormat.SPLUNK,
    targetFormat: DetectionFormat.SIGMA,
    sourceContent: 'source2',
    translatedContent: 'translated2',
    confidenceScore: 85,
    status: TranslationJobStatus.FAILED,
    errorDetails: 'Translation failed',
    duration: 2000,
    createdAt: new Date()
  }
];

const mockBatchStatus = {
  jobId: '123',
  totalDetections: 2,
  processedDetections: 2,
  successfulTranslations: 1,
  failedTranslations: 1,
  status: TranslationJobStatus.COMPLETED,
  errorSummary: { 'Translation failed': 1 },
  averageConfidence: 91.5,
  duration: 3500,
  createdAt: new Date(),
  completedAt: new Date()
};

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const mockStore = {
    getState: () => ({}),
    subscribe: vi.fn(),
    dispatch: vi.fn()
  };

  return {
    ...render(
      <Provider store={mockStore}>
        {ui}
      </Provider>
    ),
    mockStore
  };
};

describe('BatchTranslation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as jest.Mock).mockReturnValue({
      translateBatch: vi.fn(),
      progress: { total: 0, completed: 0, failed: 0 },
      translations: [],
      loading: false,
      error: null,
      abort: vi.fn()
    });
  });

  describe('UI Rendering', () => {
    test('renders batch upload interface with all required elements', () => {
      renderWithProviders(<BatchTranslation />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText(/Batch Translation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
      expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
    });

    test('displays proper loading states during file processing', async () => {
      const { mockStore } = renderWithProviders(<BatchTranslation />);
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      
      fireEvent.click(uploadButton);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(mockStore.dispatch).toHaveBeenCalled();
      });
    });

    test('shows format selection dropdown with all supported formats', () => {
      renderWithProviders(<BatchTranslation />);
      const formatSelector = screen.getByRole('combobox', { name: /target format/i });
      
      expect(formatSelector).toBeInTheDocument();
      Object.values(DetectionFormat).forEach(format => {
        expect(screen.getByText(format)).toBeInTheDocument();
      });
    });
  });

  describe('File Upload Functionality', () => {
    test('handles single file upload correctly', async () => {
      const translateBatch = vi.fn().mockResolvedValue(mockBatchStatus);
      (useTranslation as jest.Mock).mockReturnValue({
        translateBatch,
        progress: { total: 1, completed: 1, failed: 0 }
      });

      renderWithProviders(<BatchTranslation />);
      const fileInput = screen.getByLabelText(/upload/i);
      
      await userEvent.upload(fileInput, mockFiles[0]);
      
      expect(translateBatch).toHaveBeenCalledWith(expect.objectContaining({
        files: [mockFiles[0]]
      }));
    });

    test('validates file types and sizes', async () => {
      renderWithProviders(<BatchTranslation />);
      const invalidFile = new File(['invalid'], 'test.invalid', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/upload/i);
      
      await userEvent.upload(fileInput, invalidFile);
      
      expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
    });
  });

  describe('Translation Process', () => {
    test('initiates batch translation with correct parameters', async () => {
      const translateBatch = vi.fn().mockResolvedValue(mockBatchStatus);
      (useTranslation as jest.Mock).mockReturnValue({ translateBatch });

      renderWithProviders(<BatchTranslation />);
      const fileInput = screen.getByLabelText(/upload/i);
      
      await userEvent.upload(fileInput, mockFiles);
      
      expect(translateBatch).toHaveBeenCalledWith(expect.objectContaining({
        targetFormat: DetectionFormat.SIGMA,
        validateResults: true
      }));
    });

    test('updates progress bar and status messages', async () => {
      const { rerender } = renderWithProviders(<BatchTranslation />);
      
      // Update progress
      (useTranslation as jest.Mock).mockReturnValue({
        progress: { total: 2, completed: 1, failed: 0 },
        status: TranslationJobStatus.PROCESSING
      });
      rerender(<BatchTranslation />);
      
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('Results Display', () => {
    test('renders results grid with correct data', async () => {
      (useTranslation as jest.Mock).mockReturnValue({
        translations: mockTranslationResults,
        status: mockBatchStatus
      });

      renderWithProviders(<BatchTranslation />);
      
      mockTranslationResults.forEach(result => {
        expect(screen.getByText(result.sourceFormat)).toBeInTheDocument();
        expect(screen.getByText(`${result.confidenceScore}%`)).toBeInTheDocument();
      });
    });

    test('enables result action buttons appropriately', () => {
      renderWithProviders(<BatchTranslation />);
      const actionButtons = screen.getAllByRole('button', { name: /(view|download|report)/i });
      
      actionButtons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays validation errors properly', async () => {
      const error = new Error('Validation failed');
      (useTranslation as jest.Mock).mockReturnValue({
        error,
        status: TranslationJobStatus.FAILED
      });

      renderWithProviders(<BatchTranslation />);
      
      expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
    });

    test('shows network error messages', async () => {
      const networkError = new Error('Network error');
      (useTranslation as jest.Mock).mockReturnValue({
        error: networkError
      });

      renderWithProviders(<BatchTranslation />);
      
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderWithProviders(<BatchTranslation />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    test('supports keyboard navigation', () => {
      renderWithProviders(<BatchTranslation />);
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      
      uploadButton.focus();
      expect(document.activeElement).toBe(uploadButton);
    });

    test('provides proper ARIA labels', () => {
      renderWithProviders(<BatchTranslation />);
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Batch Translation Interface');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', expect.any(String));
    });
  });

  describe('Performance', () => {
    test('handles large batch uploads efficiently', async () => {
      const largeFileList = Array(100).fill(null).map((_, i) => 
        new File([`detection${i}`], `test${i}.spl`, { type: 'text/plain' })
      );

      const translateBatch = vi.fn().mockResolvedValue(mockBatchStatus);
      (useTranslation as jest.Mock).mockReturnValue({ translateBatch });

      renderWithProviders(<BatchTranslation />);
      const fileInput = screen.getByLabelText(/upload/i);
      
      await userEvent.upload(fileInput, largeFileList);
      
      expect(translateBatch).toHaveBeenCalledTimes(1);
    });

    test('maintains UI responsiveness during processing', async () => {
      const translateBatch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockBatchStatus), 1000))
      );
      (useTranslation as jest.Mock).mockReturnValue({ translateBatch });

      renderWithProviders(<BatchTranslation />);
      const fileInput = screen.getByLabelText(/upload/i);
      
      await userEvent.upload(fileInput, mockFiles);
      
      // UI should remain interactive
      expect(fileInput).toBeEnabled();
      expect(screen.getByRole('button', { name: /upload/i })).toBeEnabled();
    });
  });
});