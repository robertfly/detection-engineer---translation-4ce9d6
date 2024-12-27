// @testing-library/react version: 14.0.0
// @testing-library/user-event version: 14.0.0
// @testing-library/jest-dom version: 6.1.0
// @jest/globals version: 29.7.0
// styled-components version: 5.3.0

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import Button from '../../../src/components/common/Button';
import { COLORS, TYPOGRAPHY, SPACING } from '../../../src/styles/variables';

// Custom render function with theme provider
const renderWithTheme = (ui: React.ReactNode, options = {}) => {
  const theme = createTheme({
    palette: {
      primary: {
        main: COLORS.primary.main,
      },
    },
  });
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>,
    options
  );
};

describe('Button Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Mock matchMedia for reduced motion tests
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      renderWithTheme(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('MuiButton-contained');
      expect(button).toHaveStyle({
        backgroundColor: COLORS.primary.main,
      });
    });

    it('renders all variant types correctly', () => {
      const variants = ['contained', 'outlined', 'text', 'tonal'] as const;
      variants.forEach(variant => {
        renderWithTheme(<Button variant={variant}>Button</Button>);
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`MuiButton-${variant}`);
      });
    });

    it('renders different sizes correctly', () => {
      const sizes = ['small', 'medium', 'large', 'touch'] as const;
      sizes.forEach(size => {
        renderWithTheme(<Button size={size}>Button</Button>);
        const button = screen.getByRole('button');
        const expectedHeight = size === 'touch' ? '44px' : undefined;
        if (expectedHeight) {
          expect(button).toHaveStyle({ minHeight: expectedHeight });
        }
      });
    });

    it('renders with icons correctly', () => {
      const startIcon = <span data-testid="start-icon">→</span>;
      const endIcon = <span data-testid="end-icon">←</span>;
      
      renderWithTheme(
        <Button startIcon={startIcon} endIcon={endIcon}>
          Button
        </Button>
      );
      
      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });

    it('renders in loading state correctly', () => {
      renderWithTheme(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles click events correctly', async () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button onClick={handleClick}>Click me</Button>);
      
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents interaction when disabled', async () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button disabled onClick={handleClick}>Disabled</Button>);
      
      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('prevents interaction when loading', async () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button loading onClick={handleClick}>Loading</Button>);
      
      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('supports keyboard interaction', async () => {
      const handleClick = jest.fn();
      renderWithTheme(<Button onClick={handleClick}>Press me</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      
      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      await user.keyboard('[Enter]');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      renderWithTheme(
        <Button disabled aria-label="Custom label" tooltip="Helpful tip">
          Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
      expect(button).toHaveAttribute('title', 'Helpful tip');
    });

    it('maintains sufficient touch target size', () => {
      renderWithTheme(<Button size="touch">Touch Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        minHeight: '44px',
        minWidth: '44px',
      });
    });

    it('supports reduced motion preferences', () => {
      // Mock reduced motion preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }));

      renderWithTheme(<Button>Reduced Motion</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        transition: 'all 0ms cubic-bezier(0.4, 0, 0.2, 1)',
      });
    });
  });

  describe('Styling', () => {
    it('applies correct color styles based on variant', () => {
      renderWithTheme(
        <Button variant="contained" color="primary">
          Colored Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: COLORS.primary.main,
        color: COLORS.primary.contrastText,
      });
    });

    it('applies correct size styles', () => {
      renderWithTheme(<Button size="large">Large Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        padding: `${SPACING.sizes.md} ${SPACING.sizes.lg}`,
        fontSize: TYPOGRAPHY.fontSizes.lg,
      });
    });

    it('handles fullWidth prop correctly', () => {
      renderWithTheme(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ width: '100%' });
    });

    it('applies correct disabled styles', () => {
      renderWithTheme(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        opacity: '0.8',
        cursor: 'not-allowed',
      });
    });
  });
});