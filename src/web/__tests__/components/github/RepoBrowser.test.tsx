// React Testing Library version: ^14.0.0
// Vitest version: ^0.34.0
// @axe-core/react version: ^4.7.3
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureAxe, toHaveNoViolations } from 'axe-core/react';
import RepoBrowser from '../../../src/components/github/RepoBrowser';
import { useGithub } from '../../../src/hooks/useGithub';
import { GitHubRepository, GitHubFile } from '../../../src/interfaces/github';
import { createTestStore } from '../../../src/utils/testUtils';

// Mock useGithub hook
vi.mock('../../../src/hooks/useGithub');

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Test data
const mockRepositories: GitHubRepository[] = [
  {
    id: 1,
    name: 'test-repo',
    fullName: 'org/test-repo',
    url: 'https://github.com/org/test-repo',
    defaultBranch: 'main',
    permissions: {
      admin: true,
      push: true,
      pull: true
    }
  }
];

const mockFiles: GitHubFile[] = [
  {
    path: 'detections/splunk/alert1.spl',
    name: 'alert1.spl',
    sha: '123abc',
    size: 1024,
    type: 'file',
    content: 'index=security',
    encoding: 'utf8',
    lastModified: new Date(),
    validationStatus: { isValid: true, message: 'Valid' }
  },
  {
    path: 'detections/sigma/alert2.yml',
    name: 'alert2.yml',
    sha: '456def',
    size: 2048,
    type: 'file',
    content: 'title: Test Alert',
    encoding: 'utf8',
    lastModified: new Date(),
    validationStatus: { isValid: false, message: 'Invalid format' }
  }
];

const mockRateLimit = {
  remaining: 100,
  reset: Date.now() + 3600000,
  limit: 1000
};

/**
 * Helper function to render component with required providers and accessibility testing
 */
const renderWithProviders = (
  ui: React.ReactElement,
  { initialState = {}, ...options } = {}
) => {
  const store = createTestStore(initialState);
  const axe = configureAxe({
    rules: [
      { id: 'color-contrast', enabled: true },
      { id: 'aria-roles', enabled: true }
    ]
  });

  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <Provider store={store}>{children}</Provider>
      ),
      ...options
    }),
    axe,
    store
  };
};

describe('RepoBrowser Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementation
    (useGithub as jest.Mock).mockReturnValue({
      repositories: mockRepositories,
      selectedFiles: mockFiles,
      loading: false,
      error: null,
      rateLimit: mockRateLimit,
      fetchRepositories: vi.fn(),
      fetchRepositoryFiles: vi.fn(),
      validateFiles: vi.fn().mockResolvedValue([{ isValid: true }])
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA standards', async () => {
      const { axe } = renderWithProviders(
        <RepoBrowser onFileSelect={() => {}} />
      );

      const results = await axe(screen.getByRole('tree'));
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const tree = screen.getByRole('tree');
      tree.focus();

      // Test keyboard navigation
      fireEvent.keyDown(tree, { key: 'ArrowDown' });
      expect(screen.getByText('alert1.spl')).toHaveFocus();

      fireEvent.keyDown(tree, { key: 'ArrowDown' });
      expect(screen.getByText('alert2.yml')).toHaveFocus();

      fireEvent.keyDown(tree, { key: 'Enter' });
      expect(screen.getByText('alert2.yml')).toBeSelected();
    });

    it('should announce file validation status to screen readers', () => {
      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const validFile = screen.getByText('alert1.spl');
      const invalidFile = screen.getByText('alert2.yml');

      expect(validFile).toHaveAccessibleDescription('Valid');
      expect(invalidFile).toHaveAccessibleDescription('Invalid format');
    });
  });

  describe('Security Controls', () => {
    it('should handle rate limiting', async () => {
      (useGithub as jest.Mock).mockReturnValue({
        ...useGithub(),
        rateLimit: { remaining: 0, reset: Date.now() + 3600000, limit: 1000 }
      });

      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const refreshButton = screen.getByLabelText('Refresh repository');
      expect(refreshButton).toBeDisabled();
      
      const warning = await screen.findByText(/rate limit exceeded/i);
      expect(warning).toBeInTheDocument();
    });

    it('should validate file size and type restrictions', async () => {
      const onFileSelect = vi.fn();
      const maxFileSize = 1024;
      
      renderWithProviders(
        <RepoBrowser 
          onFileSelect={onFileSelect}
          maxFileSize={maxFileSize}
          allowedFileTypes={['.spl', '.yml']}
        />
      );

      // Select oversized file
      const largeFile = screen.getByText('alert2.yml');
      fireEvent.click(largeFile);

      await waitFor(() => {
        expect(onFileSelect).not.toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ path: 'detections/sigma/alert2.yml' })
          ])
        );
      });
    });

    it('should handle unauthorized access attempts', async () => {
      (useGithub as jest.Mock).mockReturnValue({
        ...useGithub(),
        repositories: [{
          ...mockRepositories[0],
          permissions: { admin: false, push: false, pull: false }
        }]
      });

      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const refreshButton = screen.getByLabelText('Refresh repository');
      fireEvent.click(refreshButton);

      const error = await screen.findByText(/insufficient permissions/i);
      expect(error).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adjust layout for mobile viewport', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const container = screen.getByRole('tree').parentElement;
      expect(container).toHaveStyle({ flexDirection: 'column' });
    });

    it('should support touch interactions', async () => {
      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const file = screen.getByText('alert1.spl');
      
      fireEvent.touchStart(file);
      fireEvent.touchEnd(file);

      await waitFor(() => {
        expect(file).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Repository Management', () => {
    it('should display repository files with validation status', async () => {
      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const validFile = screen.getByText('alert1.spl');
      const invalidFile = screen.getByText('alert2.yml');

      expect(validFile).toBeInTheDocument();
      expect(invalidFile).toBeInTheDocument();

      const validIcon = within(validFile.parentElement!).getByTestId('CheckCircleIcon');
      const invalidIcon = within(invalidFile.parentElement!).getByTestId('ErrorIcon');

      expect(validIcon).toHaveStyle({ color: 'success' });
      expect(invalidIcon).toHaveStyle({ color: 'error' });
    });

    it('should handle file selection and validation', async () => {
      const onFileSelect = vi.fn();
      
      renderWithProviders(
        <RepoBrowser onFileSelect={onFileSelect} />
      );

      const file = screen.getByText('alert1.spl');
      fireEvent.click(file);

      await waitFor(() => {
        expect(onFileSelect).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'detections/splunk/alert1.spl',
              validationStatus: { isValid: true }
            })
          ])
        );
      });
    });

    it('should refresh repository contents', async () => {
      const fetchRepositories = vi.fn();
      const fetchRepositoryFiles = vi.fn();

      (useGithub as jest.Mock).mockReturnValue({
        ...useGithub(),
        fetchRepositories,
        fetchRepositoryFiles
      });

      renderWithProviders(<RepoBrowser onFileSelect={() => {}} />);

      const refreshButton = screen.getByLabelText('Refresh repository');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(fetchRepositories).toHaveBeenCalled();
        expect(fetchRepositoryFiles).toHaveBeenCalled();
      });
    });
  });
});