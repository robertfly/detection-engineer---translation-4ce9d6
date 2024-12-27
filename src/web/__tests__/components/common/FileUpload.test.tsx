// @testing-library/react version: 14.0.0
// @testing-library/user-event version: 14.0.0
// vitest version: 0.34.0
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FileUpload } from '../../../src/components/common/FileUpload';
import { DetectionFormat } from '../../../src/interfaces/detection';

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
    isFocused: false,
  })),
}));

// Helper function to create mock files
const createMockFile = (name: string, size: number = 1024, type: string = 'text/plain'): File => {
  const blob = new Blob([''], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Common test setup
const setupTest = (props = {}) => {
  const defaultProps = {
    onFilesSelected: vi.fn(),
    acceptedFormats: [DetectionFormat.SPLUNK, DetectionFormat.SIGMA],
    maxFileSize: 5242880,
    maxFiles: 100,
    showProgress: false,
    progress: 0,
    ariaLabel: 'Upload detection files',
  };

  return {
    onFilesSelected: defaultProps.onFilesSelected,
    ...render(<FileUpload {...defaultProps} {...props} />),
  };
};

describe('FileUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Accessibility Features', () => {
    test('renders with correct ARIA attributes and keyboard navigation support', () => {
      setupTest();
      
      const uploadArea = screen.getByRole('button', { name: /upload detection files/i });
      expect(uploadArea).toHaveAttribute('tabIndex', '0');
      expect(uploadArea).toHaveAttribute('aria-label', 'Upload detection files');
      
      const fileInput = screen.getByLabelText('File input');
      expect(fileInput).toBeInTheDocument();
    });

    test('handles keyboard interactions correctly', async () => {
      const { onFilesSelected } = setupTest();
      const uploadArea = screen.getByRole('button');
      
      // Test Enter key
      fireEvent.keyDown(uploadArea, { key: 'Enter', code: 'Enter' });
      await waitFor(() => {
        expect(uploadArea).toHaveFocus();
      });

      // Test Space key
      fireEvent.keyDown(uploadArea, { key: ' ', code: 'Space' });
      await waitFor(() => {
        expect(uploadArea).toHaveFocus();
      });
    });

    test('announces upload status to screen readers', async () => {
      const { onFilesSelected } = setupTest();
      const validFile = createMockFile('test.spl');
      
      const fileInput = screen.getByLabelText('File input');
      await userEvent.upload(fileInput, validFile);
      
      // Check for status message
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/successfully uploaded/i);
    });
  });

  describe('File Validation', () => {
    test('validates file formats correctly', async () => {
      const { onFilesSelected } = setupTest();
      
      const validFile = createMockFile('test.spl');
      const invalidFile = createMockFile('test.txt');
      
      const fileInput = screen.getByLabelText('File input');
      
      // Test valid file
      await userEvent.upload(fileInput, validFile);
      expect(onFilesSelected).toHaveBeenCalledWith([validFile], undefined);
      
      // Test invalid file
      await userEvent.upload(fileInput, invalidFile);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/file format not supported/i);
    });

    test('enforces file size limits', async () => {
      const maxFileSize = 1000;
      const { onFilesSelected } = setupTest({ maxFileSize });
      
      const largeFile = createMockFile('large.spl', maxFileSize + 1);
      const fileInput = screen.getByLabelText('File input');
      
      await userEvent.upload(fileInput, largeFile);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/file size exceeds limit/i);
    });

    test('handles batch upload limits', async () => {
      const maxFiles = 2;
      const { onFilesSelected } = setupTest({ maxFiles });
      
      const files = [
        createMockFile('test1.spl'),
        createMockFile('test2.spl'),
        createMockFile('test3.spl'),
      ];
      
      const fileInput = screen.getByLabelText('File input');
      await userEvent.upload(fileInput, files);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/too many files selected/i);
    });
  });

  describe('Progress Tracking', () => {
    test('displays progress bar correctly', () => {
      const progress = 45;
      setupTest({ showProgress: true, progress });
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-label', 'Upload progress');
      expect(progressBar).toHaveAttribute('aria-valuenow', progress.toString());
    });

    test('updates progress bar value', async () => {
      const { rerender } = render(
        <FileUpload
          onFilesSelected={vi.fn()}
          acceptedFormats={[DetectionFormat.SPLUNK]}
          showProgress={true}
          progress={0}
        />
      );
      
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      
      rerender(
        <FileUpload
          onFilesSelected={vi.fn()}
          acceptedFormats={[DetectionFormat.SPLUNK]}
          showProgress={true}
          progress={75}
        />
      );
      
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  describe('Error Handling', () => {
    test('displays custom error messages', async () => {
      const customErrorMessages = {
        invalidFormat: 'Custom format error',
        sizeExceeded: 'Custom size error',
      };
      
      const { onFilesSelected } = setupTest({ errorMessages: customErrorMessages });
      const invalidFile = createMockFile('test.txt');
      
      const fileInput = screen.getByLabelText('File input');
      await userEvent.upload(fileInput, invalidFile);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(customErrorMessages.invalidFormat);
    });

    test('handles multiple validation errors', async () => {
      const { onFilesSelected } = setupTest({ maxFileSize: 1000 });
      const invalidFile = createMockFile('test.txt', 2000);
      
      const fileInput = screen.getByLabelText('File input');
      await userEvent.upload(fileInput, invalidFile);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/file format not supported/i);
      expect(errorMessage).toHaveTextContent(/file size exceeds limit/i);
    });
  });

  describe('Drag and Drop Functionality', () => {
    test('updates visual feedback during drag operations', () => {
      const { useDropzone } = require('react-dropzone');
      useDropzone.mockImplementation(() => ({
        getRootProps: () => ({}),
        getInputProps: () => ({}),
        isDragActive: true,
        isFocused: false,
      }));
      
      setupTest();
      const dropzone = screen.getByRole('button');
      expect(dropzone).toHaveStyle({ opacity: '0.8' });
    });

    test('handles dropped files correctly', async () => {
      const { onFilesSelected } = setupTest();
      const validFile = createMockFile('test.spl');
      
      const fileInput = screen.getByLabelText('File input');
      await userEvent.upload(fileInput, validFile);
      
      expect(onFilesSelected).toHaveBeenCalledWith([validFile], undefined);
    });
  });
});