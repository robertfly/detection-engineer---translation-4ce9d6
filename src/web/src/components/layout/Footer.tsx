// React version: 18.2.0
// @mui/material version: 5.14.0
// @mui/material/styles version: 5.14.0
import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Stack,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTheme } from '../../styles/theme';

// Constants
const APP_VERSION = '1.0.0';
const CURRENT_YEAR = new Date().getFullYear();

// Styled components
const StyledFooter = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  borderTop: '1px solid',
  borderColor: theme.palette.divider,
  padding: theme.spacing(2, 0),
  zIndex: theme.zIndex.appBar - 1,
  transition: theme.transitions.create(['background-color', 'border-color']),
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

const FooterContent = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  }
}));

const FooterLinks = styled(Stack)(({ theme }) => ({
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    gap: theme.spacing(3)
  }
}));

// Interface for component props
interface FooterProps {}

/**
 * Footer component that displays copyright information, links and version details.
 * Implements Material Design 3.0 specifications with full accessibility support.
 */
const Footer: React.FC<FooterProps> = React.memo(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <StyledFooter
      component="footer"
      role="contentinfo"
      aria-label="Application footer"
    >
      <FooterContent maxWidth="lg">
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            align={isMobile ? 'center' : 'left'}
          >
            © {CURRENT_YEAR} Detection Translation Platform. All rights reserved.
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{ mt: 0.5 }}
          >
            Version {APP_VERSION}
          </Typography>
        </Box>

        <FooterLinks
          component="nav"
          aria-label="Footer navigation"
        >
          <Link
            href="/docs"
            color="text.secondary"
            underline="hover"
            variant="body2"
            sx={{
              '&:focus-visible': {
                outline: `3px solid ${theme.palette.primary.main}`,
                outlineOffset: '2px'
              }
            }}
          >
            Documentation
          </Link>
          <Link
            href="/privacy"
            color="text.secondary"
            underline="hover"
            variant="body2"
            sx={{
              '&:focus-visible': {
                outline: `3px solid ${theme.palette.primary.main}`,
                outlineOffset: '2px'
              }
            }}
          >
            Privacy Policy
          </Link>
          <Link
            href="/support"
            color="text.secondary"
            underline="hover"
            variant="body2"
            sx={{
              '&:focus-visible': {
                outline: `3px solid ${theme.palette.primary.main}`,
                outlineOffset: '2px'
              }
            }}
          >
            Support
          </Link>
        </FooterLinks>
      </FooterContent>
    </StyledFooter>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;