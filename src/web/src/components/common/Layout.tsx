// react version: 18.2.0
// @mui/material version: 5.14.0
// @mui/icons-material version: 5.14.0

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Drawer,
  IconButton,
  useMediaQuery,
  ClickAwayListener,
  FocusTrap,
} from '@mui/material';
import {
  Menu as MenuIcon,
  HighContrast,
  MotionReduce,
} from '@mui/icons-material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import Sidebar from '../layout/Sidebar';
import ErrorBoundary from './ErrorBoundary';
import { UI_CONSTANTS } from '../../config/constants';

// Enhanced interface for Layout props with accessibility features
interface LayoutProps {
  children: React.ReactNode;
  highContrastMode?: boolean;
  reducedMotion?: boolean;
}

// Enhanced styled components with accessibility considerations
const StyledMain = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'reducedMotion',
})<{ reducedMotion?: boolean }>(({ theme, reducedMotion }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  minHeight: `calc(100vh - ${UI_CONSTANTS.LAYOUT.HEADER_HEIGHT + UI_CONSTANTS.LAYOUT.FOOTER_HEIGHT}px)`,
  marginTop: UI_CONSTANTS.LAYOUT.HEADER_HEIGHT,
  marginBottom: UI_CONSTANTS.LAYOUT.FOOTER_HEIGHT,
  transition: reducedMotion ? 'none' : theme.transitions.create(['margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  outline: 'none',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const StyledContainer = styled(Container, {
  shouldForwardProp: (prop) => !['highContrastMode'].includes(String(prop)),
})<{ highContrastMode?: boolean }>(({ theme, highContrastMode }) => ({
  maxWidth: {
    xs: '100%',
    sm: '600px',
    md: '900px',
    lg: '1200px',
    xl: '1536px',
  },
  padding: theme.spacing(2),
  backgroundColor: highContrastMode ? theme.palette.background.paper : 'inherit',
  color: highContrastMode ? theme.palette.getContrastText(theme.palette.background.paper) : 'inherit',
}));

const MobileDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'reducedMotion',
})<{ reducedMotion?: boolean }>(({ theme, reducedMotion }) => ({
  display: { xs: 'block', md: 'none' },
  '& .MuiDrawer-paper': {
    width: UI_CONSTANTS.LAYOUT.DRAWER_WIDTH,
    transition: reducedMotion ? 'none' : theme.transitions.create('transform', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
}));

// Enhanced Layout component with accessibility and theme support
const Layout = React.memo<LayoutProps>(({
  children,
  highContrastMode = false,
  reducedMotion = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Enhanced drawer handlers with keyboard support
  const handleDrawerToggle = useCallback(() => {
    setMobileDrawerOpen((prev) => !prev);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setMobileDrawerOpen(false);
  }, []);

  // Handle escape key for drawer
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileDrawerOpen) {
        handleDrawerClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileDrawerOpen, handleDrawerClose]);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <ErrorBoundary>
        {/* Enhanced Header with accessibility */}
        <Header
          isDrawerOpen={mobileDrawerOpen}
          onDrawerToggle={handleDrawerToggle}
        />

        {/* Mobile navigation drawer with focus management */}
        {isMobile && (
          <FocusTrap open={mobileDrawerOpen}>
            <ClickAwayListener onClickAway={handleDrawerClose}>
              <MobileDrawer
                variant="temporary"
                anchor={theme.direction === 'rtl' ? 'right' : 'left'}
                open={mobileDrawerOpen}
                onClose={handleDrawerClose}
                reducedMotion={reducedMotion}
                ModalProps={{
                  keepMounted: true, // Better mobile performance
                }}
                sx={{
                  '& .MuiDrawer-paper': {
                    boxSizing: 'border-box',
                    width: UI_CONSTANTS.LAYOUT.DRAWER_WIDTH,
                  },
                }}
              >
                <Sidebar
                  open={mobileDrawerOpen}
                  onClose={handleDrawerClose}
                  aria-label="Mobile navigation menu"
                />
              </MobileDrawer>
            </ClickAwayListener>
          </FocusTrap>
        )}

        {/* Desktop sidebar */}
        {!isMobile && (
          <Sidebar
            open={true}
            onClose={() => {}}
            aria-label="Main navigation menu"
          />
        )}

        {/* Main content area with enhanced accessibility */}
        <StyledMain
          component="main"
          role="main"
          tabIndex={-1}
          reducedMotion={reducedMotion}
          aria-label="Main content"
        >
          <StyledContainer
            maxWidth="lg"
            highContrastMode={highContrastMode}
          >
            {children}
          </StyledContainer>
        </StyledMain>

        {/* Enhanced Footer with accessibility */}
        <Footer />
      </ErrorBoundary>
    </Box>
  );
});

// Display name for debugging
Layout.displayName = 'Layout';

export default Layout;