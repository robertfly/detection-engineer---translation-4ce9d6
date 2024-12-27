/**
 * @fileoverview Enhanced notification component with animations and accessibility features
 * Implements Material Design 3.0 guidelines and WCAG 2.1 Level AA standards
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { styled } from '@mui/material/styles';
import { Alert, Snackbar } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion'; // @version 10.16.0
import Icon from './Icon';
import {
  NotificationType,
  NotificationPosition,
  useNotification,
} from '../../hooks/useNotification';

// Notification icon mapping following Material Design 3.0 guidelines
const NOTIFICATION_ICONS = {
  [NotificationType.SUCCESS]: 'checkCircle',
  [NotificationType.ERROR]: 'error',
  [NotificationType.WARNING]: 'warning',
  [NotificationType.INFO]: 'info',
} as const;

// Animation variants for smooth transitions
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// Props interface with comprehensive documentation
interface NotificationProps {
  /** Unique identifier for the notification */
  id: string;
  /** Notification message content */
  message: string;
  /** Severity level of the notification */
  type: NotificationType;
  /** Screen position for notification */
  position?: NotificationPosition;
  /** Auto-dismiss duration in milliseconds */
  duration?: number;
  /** Pause auto-dismiss on hover */
  pauseOnHover?: boolean;
  /** Optional callback on notification close */
  onClose?: () => void;
}

// Enhanced styled Alert component with Material Design 3.0 compliance
const StyledAlert = styled(Alert)(({ theme, severity }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5, 2),
  minWidth: '300px',
  maxWidth: '500px',
  boxShadow: theme.shadows[3],
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  
  // Enhanced contrast for accessibility
  '& .MuiAlert-icon': {
    color: theme.palette[severity as keyof typeof theme.palette]?.main,
    marginRight: theme.spacing(1.5),
  },

  // Focus states for keyboard navigation
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Hover states for interactive elements
  '&:hover': {
    boxShadow: theme.shadows[4],
  },

  // Dark mode support
  [theme.breakpoints.down('sm')]: {
    width: '90vw',
    maxWidth: 'none',
    margin: theme.spacing(1),
  },
}));

// Position-specific styles with responsive spacing
const getNotificationStyles = (position: NotificationPosition, theme: any) => {
  const baseStyles = {
    position: 'fixed' as const,
    zIndex: theme.zIndex.snackbar,
  };

  const positionMap = {
    [NotificationPosition.TOP_LEFT]: {
      top: theme.spacing(2),
      left: theme.spacing(2),
    },
    [NotificationPosition.TOP_RIGHT]: {
      top: theme.spacing(2),
      right: theme.spacing(2),
    },
    [NotificationPosition.TOP_CENTER]: {
      top: theme.spacing(2),
      left: '50%',
      transform: 'translateX(-50%)',
    },
    [NotificationPosition.BOTTOM_LEFT]: {
      bottom: theme.spacing(2),
      left: theme.spacing(2),
    },
    [NotificationPosition.BOTTOM_RIGHT]: {
      bottom: theme.spacing(2),
      right: theme.spacing(2),
    },
    [NotificationPosition.BOTTOM_CENTER]: {
      bottom: theme.spacing(2),
      left: '50%',
      transform: 'translateX(-50%)',
    },
  };

  return {
    ...baseStyles,
    ...positionMap[position],
  };
};

/**
 * Enhanced notification component with animations and accessibility features
 * Follows Material Design 3.0 guidelines and WCAG 2.1 Level AA standards
 */
const Notification: React.FC<NotificationProps> = ({
  id,
  message,
  type,
  position = NotificationPosition.TOP_RIGHT,
  duration = 5000,
  pauseOnHover = true,
  onClose,
}) => {
  const { hideNotification } = useNotification();
  const timerRef = useRef<NodeJS.Timeout>();
  const [isPaused, setIsPaused] = React.useState(false);

  // Handle notification dismissal
  const handleClose = useCallback(() => {
    hideNotification(id);
    onClose?.();
  }, [hideNotification, id, onClose]);

  // Setup auto-dismissal timer with cleanup
  useEffect(() => {
    if (duration && duration > 0 && !isPaused) {
      timerRef.current = setTimeout(handleClose, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, handleClose, isPaused]);

  // Handle hover pause functionality
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(false);
      if (duration && duration > 0) {
        timerRef.current = setTimeout(handleClose, duration);
      }
    }
  }, [pauseOnHover, duration, handleClose]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={ANIMATION_VARIANTS}
        style={getNotificationStyles(position, theme)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Snackbar
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          style={{ position: 'static' }}
        >
          <StyledAlert
            severity={type}
            onClose={handleClose}
            icon={<Icon type={NOTIFICATION_ICONS[type]} size="medium" />}
            role="alert"
            aria-live={type === NotificationType.ERROR ? 'assertive' : 'polite'}
            data-testid={`notification-${id}`}
          >
            {message}
          </StyledAlert>
        </Snackbar>
      </motion.div>
    </AnimatePresence>
  );
};

export default React.memo(Notification);