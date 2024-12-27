/**
 * @fileoverview Primary navigation component that provides the main application navigation menu
 * with responsive design, authentication-aware routing, theme support, and enhanced accessibility.
 * @version 1.0.0
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  ClickAwayListener,
  Fade
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Translate,
  GitHub,
  Settings,
  DarkMode,
  LightMode,
  AccessibilityNew
} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';

// Internal imports
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { useTheme as useAppTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';

// Enhanced styled components with accessibility features
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '@media (forced-colors: active)': {
    border: '2px solid currentColor',
  }
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 240,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  '& .MuiDrawer-paper': {
    width: 240,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiDrawer-paper': {
      transition: 'none',
    },
  }
}));

// Navigation item interface
interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  requiresAuth: boolean;
  requiredRoles: string[];
  ariaLabel: string;
  shortcutKey: string;
}

// Navigation items configuration
const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    path: ROUTES.DASHBOARD,
    icon: <Dashboard />,
    requiresAuth: true,
    requiredRoles: ['user'],
    ariaLabel: 'Navigate to Dashboard',
    shortcutKey: 'Alt+D'
  },
  {
    title: 'Single Translation',
    path: ROUTES.SINGLE_TRANSLATION,
    icon: <Translate />,
    requiresAuth: true,
    requiredRoles: ['user'],
    ariaLabel: 'Navigate to Single Translation',
    shortcutKey: 'Alt+S'
  },
  {
    title: 'Batch Translation',
    path: ROUTES.BATCH_TRANSLATION,
    icon: <Translate />,
    requiresAuth: true,
    requiredRoles: ['user'],
    ariaLabel: 'Navigate to Batch Translation',
    shortcutKey: 'Alt+B'
  },
  {
    title: 'GitHub Integration',
    path: ROUTES.GITHUB_INTEGRATION,
    icon: <GitHub />,
    requiresAuth: true,
    requiredRoles: ['user'],
    ariaLabel: 'Navigate to GitHub Integration',
    shortcutKey: 'Alt+G'
  },
  {
    title: 'Settings',
    path: ROUTES.SETTINGS,
    icon: <Settings />,
    requiresAuth: true,
    requiredRoles: ['user'],
    ariaLabel: 'Navigate to Settings',
    shortcutKey: 'Alt+T'
  }
];

interface NavigationProps {
  highContrastMode?: boolean;
  onAccessibilityChange?: (mode: boolean) => void;
}

const Navigation: React.FC<NavigationProps> = ({
  highContrastMode = false,
  onAccessibilityChange
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, userRoles } = useAuth();
  const { mode, toggleTheme } = useAppTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [selectedPath, setSelectedPath] = useState(location.pathname);

  // Handle drawer toggle with accessibility
  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Enhanced navigation handler with security and accessibility
  const handleNavigation = useCallback((item: NavItem) => {
    try {
      if (item.requiresAuth && !isAuthenticated) {
        logger.warn('Unauthorized navigation attempt', { path: item.path });
        navigate('/login');
        return;
      }

      if (item.requiredRoles.length > 0 && 
          !item.requiredRoles.some(role => userRoles.includes(role))) {
        logger.warn('Insufficient permissions for navigation', {
          path: item.path,
          requiredRoles: item.requiredRoles,
          userRoles
        });
        return;
      }

      setSelectedPath(item.path);
      navigate(item.path);

      if (isMobile) {
        setDrawerOpen(false);
      }

      // Announce navigation for screen readers
      const announcement = `Navigated to ${item.title}`;
      const ariaLive = document.getElementById('navigation-announcer');
      if (ariaLive) {
        ariaLive.textContent = announcement;
      }

    } catch (error) {
      logger.error('Navigation error', { error, path: item.path });
    }
  }, [isAuthenticated, userRoles, navigate, isMobile]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      NAV_ITEMS.forEach(item => {
        if (event.key === item.shortcutKey.split('+')[1] && event.altKey) {
          event.preventDefault();
          handleNavigation(item);
        }
      });
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNavigation]);

  return (
    <>
      <StyledAppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="h1" sx={{ flexGrow: 1 }}>
            Detection Translation Platform
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={`Toggle ${mode === 'light' ? 'dark' : 'light'} mode`}>
              <IconButton
                color="inherit"
                onClick={toggleTheme}
                aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
              >
                {mode === 'light' ? <DarkMode /> : <LightMode />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Accessibility options">
              <IconButton
                color="inherit"
                onClick={() => onAccessibilityChange?.(!highContrastMode)}
                aria-label="Toggle high contrast mode"
              >
                <AccessibilityNew />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </StyledAppBar>

      <StyledDrawer
        variant={isMobile ? "temporary" : "permanent"}
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
      >
        <Toolbar />
        <Divider />
        <List role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <ListItem
              button
              key={item.path}
              selected={selectedPath === item.path}
              onClick={() => handleNavigation(item)}
              aria-label={item.ariaLabel}
              aria-current={selectedPath === item.path ? 'page' : undefined}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText 
                primary={item.title}
                secondary={item.shortcutKey}
                primaryTypographyProps={{
                  variant: 'body2',
                  color: selectedPath === item.path ? 'primary' : 'textPrimary',
                }}
              />
            </ListItem>
          ))}
        </List>
      </StyledDrawer>

      {/* Accessibility announcer */}
      <div
        id="navigation-announcer"
        role="status"
        aria-live="polite"
        className="sr-only"
      />
    </>
  );
};

export default Navigation;