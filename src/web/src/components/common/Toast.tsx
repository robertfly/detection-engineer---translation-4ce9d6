// @package     react@18.2.0
// @package     @mui/material@5.14.0
// @package     @mui/material/styles@5.14.0
// @package     framer-motion@10.16.0

import React, { useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import { Snackbar, Alert, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationType, NotificationPosition } from '../../hooks/useNotification';

// Animation variants for smooth toast transitions
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: {
      duration: 0.15,
      ease: 'easeIn'
    }
  }
};

// Props interface with comprehensive type safety
interface ToastProps {
  message: string;
  type: NotificationType;
  position?: NotificationPosition;
  duration?: number;
  onClose?: () => void;
}

// Enhanced Snackbar with Material Design 3.0 styling
const StyledSnackbar = styled(Snackbar)(({ theme }) => ({
  '& .MuiAlert-root': {
    ...theme.typography.body2,
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[6],
    minWidth: '300px',
    maxWidth: '600px',
    padding: theme.spacing(1, 2),
    [theme.breakpoints.down('sm')]: {
      minWidth: '100%',
      margin: theme.spacing(0, 2)
    }
  },
  '& .MuiAlert-icon': {
    marginRight: theme.spacing(1)
  },
  '& .MuiAlert-message': {
    padding: theme.spacing(0.5, 0)
  },
  '& .MuiAlert-action': {
    padding: theme.spacing(0, 0.5)
  }
}));

// Position utility for toast placement
const getToastPosition = (position: NotificationPosition = NotificationPosition.TOP_RIGHT) => {
  const positions = {
    [NotificationPosition.TOP_LEFT]: {
      anchorOrigin: { vertical: 'top', horizontal: 'left' },
      style: { top: 24, left: 24 }
    },
    [NotificationPosition.TOP_RIGHT]: {
      anchorOrigin: { vertical: 'top', horizontal: 'right' },
      style: { top: 24, right: 24 }
    },
    [NotificationPosition.TOP_CENTER]: {
      anchorOrigin: { vertical: 'top', horizontal: 'center' },
      style: { top: 24 }
    },
    [NotificationPosition.BOTTOM_LEFT]: {
      anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
      style: { bottom: 24, left: 24 }
    },
    [NotificationPosition.BOTTOM_RIGHT]: {
      anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
      style: { bottom: 24, right: 24 }
    },
    [NotificationPosition.BOTTOM_CENTER]: {
      anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      style: { bottom: 24 }
    }
  };

  return positions[position];
};

/**
 * Toast component for displaying animated notification messages
 * with comprehensive accessibility support and Material Design 3.0 styling
 */
const Toast: React.FC<ToastProps> = ({
  message,
  type,
  position = NotificationPosition.TOP_RIGHT,
  duration = 5000,
  onClose
}) => {
  const [open, setOpen] = useState(true);
  const theme = useTheme();

  // Handle auto-dismissal
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  // Handle close events
  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
    onClose?.();
  };

  // Get position configuration
  const positionConfig = getToastPosition(position);

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={ANIMATION_VARIANTS}
        >
          <StyledSnackbar
            open={open}
            onClose={handleClose}
            {...positionConfig.anchorOrigin}
            style={positionConfig.style}
            sx={{ zIndex: theme.zIndex.snackbar }}
          >
            <Alert
              onClose={handleClose}
              severity={type}
              variant="filled"
              elevation={6}
              role="alert"
              aria-live={type === NotificationType.ERROR ? 'assertive' : 'polite'}
            >
              {message}
            </Alert>
          </StyledSnackbar>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;