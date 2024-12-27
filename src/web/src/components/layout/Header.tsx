// react version: 18.2.0
// @mui/material version: 5.14.0
// @mui/icons-material version: 5.14.0

import React, { useState, useCallback, memo } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  Box,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  AccountCircle,
  ContrastOutlined,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Enhanced interface for Header props with accessibility options
interface HeaderProps {
  isDrawerOpen: boolean;
  onDrawerToggle: () => void;
}

// Styled components with enhanced accessibility and responsive design
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  '& .MuiIconButton-root': {
    'aria-label': 'required',
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1, 0),
  },
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(0, 2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0, 1),
    minHeight: 56,
  },
}));

// Enhanced Header component with accessibility and security features
const Header = memo(({ isDrawerOpen, onDrawerToggle }: HeaderProps) => {
  // State management for user menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Authentication and theme hooks
  const { isAuthenticated, user, logout, validateSession } = useAuth();
  const { mode, toggleTheme, contrast, toggleContrast } = useTheme();
  
  // Responsive breakpoint detection
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('sm'));

  // Enhanced menu handlers with security validation
  const handleMenuOpen = useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    if (await validateSession()) {
      setAnchorEl(event.currentTarget);
    } else {
      await logout();
    }
  }, [validateSession, logout]);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Secure logout handler
  const handleLogout = useCallback(async () => {
    handleMenuClose();
    await logout();
  }, [logout]);

  return (
    <StyledAppBar position="fixed">
      <StyledToolbar>
        {/* Navigation toggle with enhanced accessibility */}
        <IconButton
          color="inherit"
          aria-label={isDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
          edge="start"
          onClick={onDrawerToggle}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Application title with responsive typography */}
        <Typography
          variant={isMobile ? "h6" : "h5"}
          component="h1"
          sx={{ flexGrow: 1, ml: 1 }}
          noWrap
        >
          Detection Translation Platform
        </Typography>

        {/* Theme controls with accessibility support */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            color="inherit"
            onClick={toggleContrast}
            aria-label={`Toggle high contrast mode: ${contrast ? 'on' : 'off'}`}
          >
            <ContrastOutlined />
          </IconButton>
          
          <IconButton
            color="inherit"
            onClick={toggleTheme}
            aria-label={`Toggle theme: ${mode === 'light' ? 'dark' : 'light'} mode`}
          >
            {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
          </IconButton>

          {/* User menu with security features */}
          {isAuthenticated && (
            <>
              <IconButton
                aria-label="Open user menu"
                aria-controls="user-menu"
                aria-haspopup="true"
                aria-expanded={Boolean(anchorEl)}
                onClick={handleMenuOpen}
                color="inherit"
              >
                {user?.name ? (
                  <Avatar
                    alt={user.name}
                    src=""
                    sx={{ width: 32, height: 32 }}
                  >
                    {user.name.charAt(0)}
                  </Avatar>
                ) : (
                  <AccountCircle />
                )}
              </IconButton>
              
              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                keepMounted
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
                <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </StyledToolbar>
    </StyledAppBar>
  );
});

// Display name for debugging
Header.displayName = 'Header';

export default Header;