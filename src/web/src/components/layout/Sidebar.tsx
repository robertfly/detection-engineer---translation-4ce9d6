// @mui/material version: 5.14.0
// @mui/icons-material version: 5.14.0
// react version: 18.2.0
// react-router-dom version: 6.14.0

import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery,
  Tooltip,
  styled,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Dashboard as DashboardIcon,
  Translate as TranslateIcon,
  GitHub as GitHubIcon,
  Settings as SettingsIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { UI_CONSTANTS } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../utils/logger';

// Enhanced styled components with Material Design 3.0
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: UI_CONSTANTS.LAYOUT.DRAWER_WIDTH,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: UI_CONSTANTS.LAYOUT.DRAWER_WIDTH,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: UI_CONSTANTS.TRANSITIONS.DURATION,
    }),
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// Enhanced interface for navigation items with security
interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  requiresAuth: boolean;
  requiredPermissions: string[];
  ariaLabel: string;
  testId: string;
}

// Enhanced navigation routes with security
const ROUTES = {
  DASHBOARD: '/dashboard',
  SINGLE_TRANSLATION: '/translation/single',
  BATCH_TRANSLATION: '/translation/batch',
  GITHUB_INTEGRATION: '/github',
  SETTINGS: '/settings',
  ERROR: '/error',
} as const;

// Enhanced navigation items with security and accessibility
const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    path: ROUTES.DASHBOARD,
    icon: <DashboardIcon />,
    requiresAuth: true,
    requiredPermissions: ['view:dashboard'],
    ariaLabel: 'Navigate to dashboard',
    testId: 'nav-dashboard',
  },
  {
    title: 'Single Translation',
    path: ROUTES.SINGLE_TRANSLATION,
    icon: <TranslateIcon />,
    requiresAuth: true,
    requiredPermissions: ['translate:single'],
    ariaLabel: 'Navigate to single translation',
    testId: 'nav-single-translation',
  },
  {
    title: 'Batch Translation',
    path: ROUTES.BATCH_TRANSLATION,
    icon: <TranslateIcon />,
    requiresAuth: true,
    requiredPermissions: ['translate:batch'],
    ariaLabel: 'Navigate to batch translation',
    testId: 'nav-batch-translation',
  },
  {
    title: 'GitHub Integration',
    path: ROUTES.GITHUB_INTEGRATION,
    icon: <GitHubIcon />,
    requiresAuth: true,
    requiredPermissions: ['github:access'],
    ariaLabel: 'Navigate to GitHub integration',
    testId: 'nav-github',
  },
  {
    title: 'Settings',
    path: ROUTES.SETTINGS,
    icon: <SettingsIcon />,
    requiresAuth: true,
    requiredPermissions: ['settings:view'],
    ariaLabel: 'Navigate to settings',
    testId: 'nav-settings',
  },
];

// Enhanced sidebar props with accessibility
interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

// Enhanced sidebar component with security and accessibility
const Sidebar: React.FC<SidebarProps> = memo(({
  open,
  onClose,
  width = UI_CONSTANTS.LAYOUT.DRAWER_WIDTH,
  className,
  role = 'navigation',
  'aria-label': ariaLabel = 'Main navigation',
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedPath, setSelectedPath] = useState<string>(location.pathname);

  // Enhanced navigation handler with security
  const handleNavigation = useCallback(async (path: string, requiredPermissions: string[]) => {
    try {
      if (!isAuthenticated) {
        logger.warn('Unauthorized navigation attempt', { path });
        navigate('/login');
        return;
      }

      // Check permissions
      const hasPermission = requiredPermissions.every(permission => 
        user?.permissions.includes(permission)
      );

      if (!hasPermission) {
        logger.warn('Insufficient permissions for navigation', {
          path,
          requiredPermissions,
          userPermissions: user?.permissions,
        });
        navigate(ROUTES.ERROR);
        return;
      }

      setSelectedPath(path);
      navigate(path);

      if (isMobile) {
        onClose();
      }

      logger.info('Navigation successful', { path });
    } catch (error) {
      logger.error('Navigation error', { error, path });
      navigate(ROUTES.ERROR);
    }
  }, [isAuthenticated, user, navigate, isMobile, onClose]);

  // Update selected path on location change
  useEffect(() => {
    setSelectedPath(location.pathname);
  }, [location]);

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={open}
      onClose={onClose}
      className={className}
      role={role}
      aria-label={ariaLabel}
      data-testid="sidebar"
    >
      <DrawerHeader>
        <IconButton
          onClick={onClose}
          aria-label="Close navigation drawer"
          data-testid="sidebar-close"
        >
          {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        {NAV_ITEMS.map((item) => (
          <Tooltip
            key={item.path}
            title={item.title}
            placement="right"
            arrow
          >
            <ListItem
              button
              selected={selectedPath === item.path}
              onClick={() => handleNavigation(item.path, item.requiredPermissions)}
              aria-label={item.ariaLabel}
              data-testid={item.testId}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText 
                primary={item.title}
                primaryTypographyProps={{
                  variant: 'body2',
                  color: selectedPath === item.path ? 'primary' : 'textPrimary',
                }}
              />
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </StyledDrawer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;