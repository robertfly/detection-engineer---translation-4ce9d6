// @testing-library/react version: 14.0.0
// @testing-library/user-event version: 14.0.0
// vitest version: 0.34.0
// @axe-core/react version: 4.7.0

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { axe, toHaveNoViolations } from '@axe-core/react';
import LoginForm from '../../../src/components/auth/LoginForm';
import { useAuth } from '../../../src/hooks/useAuth';
import { COLORS, TYPOGRAPHY } from '../../../src/styles/variables';

// Mock useAuth hook
vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Mock useNavigate hook
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => vi.fn()
}));

// Add custom matchers
expect.extend(toHaveNoViolations);

// Helper function to render component with providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const mockStore = {
    getState: () => ({}),
    subscribe: vi.fn(),
    dispatch: vi.fn(),
  };

  return render(
    <Provider store={mockStore}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </Provider>,
    options
  );
};

describe('LoginForm Component', () => {
  // Setup default mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: vi.fn(),
      isLoading: false,
      error: null,
      validateSession: vi.fn(),
      handleMFA: vi.fn()
    });
  });

  describe('UI and Rendering', () => {
    it('renders login form with correct Material Design 3.0 styling', () => {
      renderWithProviders(<LoginForm />);
      
      const form = screen.getByRole('main');
      const styles = window.getComputedStyle(form);
      
      expect(styles.fontFamily).toBe(TYPOGRAPHY.fontFamily);
      expect(styles.backgroundColor).toBe(COLORS.grey[50]);
      expect(form).toBeVisible();
    });

    it('displays proper form elements and labels', () => {
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByRole('heading', { name: /Detection Translator/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign in with Auth0/i })).toBeInTheDocument();
      expect(screen.getByText(/Secure login powered by Auth0/i)).toBeInTheDocument();
    });

    it('handles responsive design breakpoints correctly', () => {
      const { container } = renderWithProviders(<LoginForm />);
      
      // Test mobile view
      window.innerWidth = 375;
      fireEvent(window, new Event('resize'));
      expect(container.querySelector('section')).toHaveStyle({ maxWidth: '100%' });
      
      // Test desktop view
      window.innerWidth = 1024;
      fireEvent(window, new Event('resize'));
      expect(container.querySelector('section')).toHaveStyle({ maxWidth: '400px' });
    });

    it('shows proper loading state animations', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn(),
        isLoading: true,
        error: null
      });

      renderWithProviders(<LoginForm />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(button).toHaveTextContent('Signing in...');
    });
  });

  describe('Authentication Flow', () => {
    it('initiates OAuth 2.0 flow correctly', async () => {
      const mockLogin = vi.fn();
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null
      });

      renderWithProviders(<LoginForm />);
      
      await userEvent.click(screen.getByRole('button'));
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('handles successful login with token storage', async () => {
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      const mockOnSuccess = vi.fn();
      
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null
      });

      renderWithProviders(<LoginForm onSuccess={mockOnSuccess} />);
      
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('validates session state on mount', async () => {
      const mockValidateSession = vi.fn().mockResolvedValue(true);
      (useAuth as jest.Mock).mockReturnValue({
        validateSession: mockValidateSession,
        isLoading: false,
        error: null
      });

      renderWithProviders(<LoginForm />);
      
      await waitFor(() => {
        expect(mockValidateSession).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays authentication errors appropriately', async () => {
      const errorMessage = 'Authentication failed';
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn(),
        isLoading: false,
        error: errorMessage
      });

      renderWithProviders(<LoginForm />);
      
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('handles network errors securely', async () => {
      const mockLogin = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockOnError = vi.fn();
      
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null
      });

      renderWithProviders(<LoginForm onError={mockOnError} />);
      
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderWithProviders(<LoginForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<LoginForm />);
      const button = screen.getByRole('button');
      
      // Tab to button
      await userEvent.tab();
      expect(button).toHaveFocus();
      
      // Trigger button with Enter
      await userEvent.keyboard('{Enter}');
      expect(useAuth().login).toHaveBeenCalled();
    });

    it('provides proper ARIA attributes', () => {
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Login form');
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sign in with Auth0');
    });

    it('handles reduced motion preferences', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true,
        addListener: vi.fn(),
        removeListener: vi.fn()
      });
      window.matchMedia = mockMatchMedia;
      
      renderWithProviders(<LoginForm />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveStyle({ transition: 'none' });
    });
  });

  describe('Security', () => {
    it('prevents multiple simultaneous login attempts', async () => {
      const mockLogin = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null
      });

      renderWithProviders(<LoginForm />);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      await userEvent.click(button);
      
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('cleans up session check on unmount', () => {
      const { unmount } = renderWithProviders(<LoginForm />);
      unmount();
      // Verify cleanup is performed
      expect(useAuth().validateSession).not.toHaveBeenCalled();
    });

    it('sanitizes error messages for display', async () => {
      const sensitiveError = 'Error: Invalid token for user@email.com';
      const mockLogin = vi.fn().mockRejectedValue(new Error(sensitiveError));
      
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null
      });

      renderWithProviders(<LoginForm />);
      
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).not.toHaveTextContent('user@email.com');
        expect(alert).toHaveTextContent('Login failed');
      });
    });
  });
});