/**
 * @fileoverview Comprehensive test suite for the Dashboard page component.
 * Tests functionality, accessibility, performance, and error handling.
 * @version 1.0.0
 */

// External imports
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Internal imports
import Dashboard from '../../src/pages/Dashboard';
import { useDetection } from '../../src/hooks/useDetection';
import { DetectionFormat, DetectionSeverity } from '../../interfaces/detection';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme } from '../../config/theme';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock hooks and services
vi.mock('../../src/hooks/useDetection');

// Mock data
const mockDetections = [
  {
    id: '1',
    content: 'test detection 1',
    format: DetectionFormat.SPLUNK,
    created_at: new Date().toISOString(),
    user_id: 'user1',
    is_active: true,
    metadata: {
      name: 'Test Detection 1',
      description: 'Test description',
      tags: ['test'],
      severity: DetectionSeverity.HIGH,
      last_modified: new Date()
    }
  },
  // Add more mock detections as needed
];

// Test utilities
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={lightTheme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state correctly', () => {
      // Mock loading state
      (useDetection as jest.Mock).mockReturnValue({
        detections: [],
        loading: true,
        error: null
      });

      renderWithProviders(<Dashboard />);

      // Verify loading indicators
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading detections...')).toBeInTheDocument();
    });

    it('should render error state correctly', () => {
      // Mock error state
      const errorMessage = 'Failed to load detections';
      (useDetection as jest.Mock).mockReturnValue({
        detections: [],
        loading: false,
        error: new Error(errorMessage)
      });

      renderWithProviders(<Dashboard />);

      // Verify error message
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });

    it('should render empty state correctly', () => {
      // Mock empty state
      (useDetection as jest.Mock).mockReturnValue({
        detections: [],
        loading: false,
        error: null
      });

      renderWithProviders(<Dashboard />);

      // Verify empty state message
      expect(screen.getByText('No detections found')).toBeInTheDocument();
    });

    it('should render detection list correctly', () => {
      // Mock successful state with detections
      (useDetection as jest.Mock).mockReturnValue({
        detections: mockDetections,
        loading: false,
        error: null
      });

      renderWithProviders(<Dashboard />);

      // Verify detection cards are rendered
      mockDetections.forEach(detection => {
        expect(screen.getByText(detection.metadata.name)).toBeInTheDocument();
      });
    });
  });

  describe('Interactions', () => {
    it('should handle detection selection correctly', async () => {
      const mockSelectDetection = vi.fn();
      (useDetection as jest.Mock).mockReturnValue({
        detections: mockDetections,
        loading: false,
        error: null,
        selectDetection: mockSelectDetection
      });

      renderWithProviders(<Dashboard />);

      // Click on a detection card
      const detectionCard = screen.getByText(mockDetections[0].metadata.name);
      await userEvent.click(detectionCard);

      // Verify selection handler was called
      expect(mockSelectDetection).toHaveBeenCalledWith(mockDetections[0]);
    });

    it('should handle format filtering correctly', async () => {
      const mockFetchDetections = vi.fn();
      (useDetection as jest.Mock).mockReturnValue({
        detections: mockDetections,
        loading: false,
        error: null,
        fetchDetections: mockFetchDetections
      });

      renderWithProviders(<Dashboard />);

      // Change format filter
      const formatSelect = screen.getByLabelText('Format Filter');
      await userEvent.click(formatSelect);
      await userEvent.click(screen.getByText('SPLUNK'));

      // Verify filter was applied
      expect(mockFetchDetections).toHaveBeenCalledWith(
        expect.objectContaining({ format: DetectionFormat.SPLUNK })
      );
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      (useDetection as jest.Mock).mockReturnValue({
        detections: mockDetections,
        loading: false,
        error: null
      });

      const { container } = renderWithProviders(<Dashboard />);

      // Run accessibility tests
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      (useDetection as jest.Mock).mockReturnValue({
        detections: mockDetections,
        loading: false,
        error: null
      });

      renderWithProviders(<Dashboard />);

      // Tab through interactive elements
      const user = userEvent.setup();
      await user.tab();

      // Verify focus handling
      expect(screen.getByLabelText('Format Filter')).toHaveFocus();
    });

    it('should announce dynamic content changes', async () => {
      const { rerender } = renderWithProviders(<Dashboard />);

      // Change loading state
      (useDetection as jest.Mock).mockReturnValue({
        detections: [],
        loading: true,
        error: null
      });
      rerender(<Dashboard />);

      // Verify ARIA live region updates
      expect(screen.getByRole('status')).toHaveTextContent('Loading detections...');
    });
  });

  describe('Performance', () => {
    it('should render within performance budget', async () => {
      const startTime = performance.now();

      (useDetection as jest.Mock).mockReturnValue({
        detections: mockDetections,
        loading: false,
        error: null
      });

      renderWithProviders(<Dashboard />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Verify render time is within budget (e.g., 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle large detection lists efficiently', async () => {
      // Create large dataset
      const largeDetectionList = Array.from({ length: 100 }, (_, index) => ({
        ...mockDetections[0],
        id: `detection-${index}`,
        metadata: {
          ...mockDetections[0].metadata,
          name: `Detection ${index}`
        }
      }));

      (useDetection as jest.Mock).mockReturnValue({
        detections: largeDetectionList,
        loading: false,
        error: null
      });

      const startTime = performance.now();
      renderWithProviders(<Dashboard />);
      const endTime = performance.now();

      // Verify render time scales linearly
      expect(endTime - startTime).toBeLessThan(200);
    });
  });
});