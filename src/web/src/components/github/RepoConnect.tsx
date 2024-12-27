// react version: ^18.2.0
// @mui/material version: ^5.14.0
// use-debounce version: ^9.0.0
import React, { useState, useCallback, useEffect } from 'react';
import { 
  TextField, 
  Button, 
  Alert, 
  CircularProgress, 
  Box, 
  Typography,
  FormControl,
  FormHelperText,
  IconButton,
  Tooltip
} from '@mui/material';
import { useDebounce } from 'use-debounce';
import { GitHubConfig } from '../../interfaces/github';
import { useGithub } from '../../hooks/useGithub';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { UI_CONSTANTS } from '../../config/constants';

// Enhanced validation patterns
const GITHUB_TOKEN_PATTERN = /^gh[ps]_[a-zA-Z0-9]{36}$/;
const ORG_NAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

interface RepoConnectProps {
  onConnect: (config: GitHubConfig) => Promise<void>;
  onDisconnect: () => void;
  isConnected: boolean;
  maxRetries?: number;
  rateLimitConfig?: {
    maxRequests: number;
    windowMs: number;
  };
}

interface ValidationState {
  accessToken: {
    valid: boolean;
    message: string;
  };
  organization: {
    valid: boolean;
    message: string;
  };
}

interface ErrorState {
  code: string;
  message: string;
  details?: unknown;
}

const initialValidationState: ValidationState = {
  accessToken: { valid: true, message: '' },
  organization: { valid: true, message: '' }
};

export const RepoConnect: React.FC<RepoConnectProps> = ({
  onConnect,
  onDisconnect,
  isConnected,
  maxRetries = 3,
  rateLimitConfig = {
    maxRequests: 30,
    windowMs: 3600000 // 1 hour
  }
}) => {
  // State management with security considerations
  const [accessToken, setAccessToken] = useState('');
  const [organization, setOrganization] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>(initialValidationState);
  const [retryCount, setRetryCount] = useState(0);

  // Debounce inputs for validation
  const [debouncedToken] = useDebounce(accessToken, 300);
  const [debouncedOrg] = useDebounce(organization, 300);

  // GitHub hook integration
  const { validateToken, checkRateLimit } = useGithub();

  // Security-enhanced input validation
  const validateInput = useCallback((field: 'accessToken' | 'organization', value: string): boolean => {
    let isValid = true;
    let message = '';

    switch (field) {
      case 'accessToken':
        if (!GITHUB_TOKEN_PATTERN.test(value)) {
          isValid = false;
          message = 'Invalid GitHub token format';
        }
        break;
      case 'organization':
        if (value && !ORG_NAME_PATTERN.test(value)) {
          isValid = false;
          message = 'Invalid organization name format';
        }
        break;
    }

    setValidationState(prev => ({
      ...prev,
      [field]: { valid: isValid, message }
    }));

    return isValid;
  }, []);

  // Validate inputs on change
  useEffect(() => {
    if (debouncedToken) {
      validateInput('accessToken', debouncedToken);
    }
    if (debouncedOrg) {
      validateInput('organization', debouncedOrg);
    }
  }, [debouncedToken, debouncedOrg, validateInput]);

  // Enhanced connection handler with retry logic and security measures
  const handleConnect = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate rate limiting
    if (!checkRateLimit()) {
      setError({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'GitHub rate limit exceeded. Please try again later.'
      });
      return;
    }

    // Validate inputs
    if (!validateInput('accessToken', accessToken) || 
        (organization && !validateInput('organization', organization))) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate token before connecting
      const isTokenValid = await validateToken(accessToken);
      if (!isTokenValid) {
        throw new Error('Invalid GitHub token');
      }

      // Track security metrics
      metrics.trackSecurityMetric(
        {
          type: 'github_connection_attempt',
          severity: 'medium',
          details: { organization },
          source: 'repo_connect'
        },
        {
          userId: sessionStorage.getItem('userId') || '',
          sessionId: sessionStorage.getItem('sessionId') || '',
          userRole: sessionStorage.getItem('userRole') || '',
          ipAddress: '',
          timestamp: Date.now()
        }
      );

      await onConnect({
        accessToken,
        apiUrl: 'https://api.github.com',
        organization: organization || null,
        rateLimitConfig
      });

      // Reset retry count on success
      setRetryCount(0);
      
    } catch (error: any) {
      logger.error('GitHub connection failed', { error });
      
      // Handle retry logic
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setError({
          code: 'CONNECTION_RETRY',
          message: `Connection failed. Retrying... (${retryCount + 1}/${maxRetries})`,
          details: error
        });
        // Implement exponential backoff
        setTimeout(() => handleConnect(event), Math.pow(2, retryCount) * 1000);
      } else {
        setError({
          code: error.code || 'CONNECTION_ERROR',
          message: error.message || 'Failed to connect to GitHub',
          details: error
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    accessToken,
    organization,
    onConnect,
    validateToken,
    checkRateLimit,
    retryCount,
    maxRetries,
    rateLimitConfig
  ]);

  // Secure disconnection handler
  const handleDisconnect = useCallback(() => {
    setAccessToken('');
    setOrganization('');
    setError(null);
    setValidationState(initialValidationState);
    setRetryCount(0);
    onDisconnect();
  }, [onDisconnect]);

  return (
    <Box
      component="form"
      onSubmit={handleConnect}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: UI_CONSTANTS.SPACING.MEDIUM,
        maxWidth: 600,
        width: '100%',
        p: UI_CONSTANTS.SPACING.MEDIUM
      }}
    >
      <Typography variant="h6" component="h2">
        GitHub Repository Connection
      </Typography>

      {error && (
        <Alert 
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: UI_CONSTANTS.SPACING.MEDIUM }}
        >
          {error.message}
        </Alert>
      )}

      <FormControl error={!validationState.accessToken.valid}>
        <TextField
          id="github-token"
          label="GitHub Access Token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          disabled={isConnected || isLoading}
          error={!validationState.accessToken.valid}
          required
          fullWidth
          inputProps={{
            'aria-label': 'GitHub Access Token',
            'aria-describedby': 'github-token-helper-text',
            autoComplete: 'off'
          }}
        />
        {!validationState.accessToken.valid && (
          <FormHelperText id="github-token-helper-text">
            {validationState.accessToken.message}
          </FormHelperText>
        )}
      </FormControl>

      <FormControl error={!validationState.organization.valid}>
        <TextField
          id="github-org"
          label="Organization (Optional)"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          disabled={isConnected || isLoading}
          error={!validationState.organization.valid}
          fullWidth
          inputProps={{
            'aria-label': 'GitHub Organization',
            'aria-describedby': 'github-org-helper-text'
          }}
        />
        {!validationState.organization.valid && (
          <FormHelperText id="github-org-helper-text">
            {validationState.organization.message}
          </FormHelperText>
        )}
      </FormControl>

      <Box sx={{ display: 'flex', gap: UI_CONSTANTS.SPACING.MEDIUM }}>
        {!isConnected ? (
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || !validationState.accessToken.valid || !validationState.organization.valid}
            startIcon={isLoading && <CircularProgress size={20} />}
            aria-label={isLoading ? 'Connecting...' : 'Connect to GitHub'}
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={handleDisconnect}
            color="secondary"
            aria-label="Disconnect from GitHub"
          >
            Disconnect
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default RepoConnect;