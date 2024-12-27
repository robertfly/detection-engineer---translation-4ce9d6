// react version: 18.2.0
import React, { useCallback, useEffect, useRef } from 'react';
// @mui/material version: 5.14.0
import { Modal as MuiModal, Backdrop, Fade, Box, Typography } from '@mui/material';
// @mui/material/styles version: 5.14.0
import { styled } from '@mui/material/styles';
// @mui/base version: 5.14.0
import { FocusTrap } from '@mui/base';
// @mui/material version: 5.14.0
import { useMediaQuery } from '@mui/material';

import { StyledModal } from '../../styles/components';
import { Button } from './Button';
import { SPACING, TRANSITIONS, COLORS } from '../../styles/variables';

// Enhanced Modal Props interface
interface ModalProps {
  open: boolean;
  onClose: (event: {}, reason: "backdropClick" | "escapeKeyDown") => void;
  title: string;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  maxWidth?: number | string;
  maxHeight?: number | string;
  preventScroll?: boolean;
  transitionDuration?: number;
  closeOnBackdropClick?: boolean;
  highContrastMode?: boolean;
  onError?: (error: Error) => void;
}

// Custom hook for modal animations
const useModalAnimation = (duration: number, prefersReducedMotion: boolean) => {
  return {
    enter: prefersReducedMotion ? 0 : duration,
    exit: prefersReducedMotion ? 0 : duration * 0.75,
    easing: TRANSITIONS.easing.easeInOut
  };
};

// Custom hook for focus management
const useModalFocus = (open: boolean, modalRef: React.RefObject<HTMLDivElement>) => {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      return () => {
        previousFocus.current?.focus();
      };
    }
  }, [open]);

  return {
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (event.shiftKey && document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }
  };
};

// Styled components for modal parts
const ModalHeader = styled(Box)(({ theme }) => ({
  padding: SPACING.sizes.lg,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
}));

const ModalContent = styled(Box)(({ theme }) => ({
  padding: SPACING.sizes.lg,
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  '&:focus': {
    outline: 'none'
  }
}));

const ModalActions = styled(Box)(({ theme }) => ({
  padding: SPACING.sizes.md,
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: SPACING.sizes.sm
}));

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  size = 'medium',
  fullWidth = false,
  children,
  actions,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  maxWidth = 'none',
  maxHeight = 'none',
  preventScroll = true,
  transitionDuration = 300,
  closeOnBackdropClick = true,
  highContrastMode = false,
  onError,
  ...props
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animation = useModalAnimation(transitionDuration, prefersReducedMotion);
  const focusManagement = useModalFocus(open, modalRef);

  // Handle modal close events
  const handleClose = useCallback((event: {}, reason: "backdropClick" | "escapeKeyDown") => {
    if ((reason === 'backdropClick' && !closeOnBackdropClick) || 
        (reason === 'escapeKeyDown' && disableEscapeKeyDown)) {
      return;
    }
    onClose(event, reason);
  }, [closeOnBackdropClick, disableEscapeKeyDown, onClose]);

  // Handle errors
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      onError?.(error.error);
    };

    if (open) {
      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }
  }, [open, onError]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (preventScroll && open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [preventScroll, open]);

  const getModalSize = () => {
    const sizes = {
      small: '400px',
      medium: '600px',
      large: '800px'
    };
    return sizes[size] || sizes.medium;
  };

  return (
    <StyledModal
      open={open}
      onClose={handleClose}
      closeAfterTransition
      disableAutoFocus={false}
      disableEnforceFocus={false}
      disablePortal={false}
      keepMounted={false}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      {...props}
    >
      <Fade in={open} timeout={animation}>
        <Box
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={focusManagement.onKeyDown}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: fullWidth ? '90%' : getModalSize(),
            maxWidth: maxWidth,
            maxHeight: maxHeight || '90vh',
            bgcolor: 'background.paper',
            borderRadius: SPACING.sizes.md,
            boxShadow: 24,
            outline: 'none',
            '@media (prefers-contrast: high)': {
              border: '2px solid',
              borderColor: 'text.primary'
            }
          }}
        >
          <FocusTrap open={open}>
            <div>
              <ModalHeader>
                <Typography
                  id="modal-title"
                  variant="h6"
                  component="h2"
                  sx={{ fontWeight: 'medium' }}
                >
                  {title}
                </Typography>
                {!disableEscapeKeyDown && (
                  <Button
                    aria-label="Close modal"
                    onClick={(e) => handleClose(e, 'escapeKeyDown')}
                    variant="text"
                    size="small"
                  >
                    ×
                  </Button>
                )}
              </ModalHeader>
              <ModalContent id="modal-description">
                {children}
              </ModalContent>
              {actions && <ModalActions>{actions}</ModalActions>}
            </div>
          </FocusTrap>
        </Box>
      </Fade>
    </StyledModal>
  );
};

export default Modal;