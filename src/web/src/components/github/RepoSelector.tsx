import React, { useCallback, useEffect, useMemo } from 'react';
import { useGithub } from '../../hooks/useGithub';
import { GitHubRepository } from '../../interfaces/github';
import Dropdown from '../common/Dropdown';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

// Enhanced props interface with security and accessibility features
interface RepoSelectorProps {
  organization: string;
  selectedRepoId: number | null;
  onRepositorySelect: (repoId: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  securityContext?: {
    userId: string;
    userRole: string;
    permissions: string[];
  };
  a11yProps?: {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    reducedMotion?: boolean;
  };
  validationStatus?: {
    isValid: boolean;
    message?: string;
  };
}

/**
 * Enhanced repository selector component with security validation and accessibility
 * @version 1.0.0
 */
const RepoSelector: React.FC<RepoSelectorProps> = ({
  organization,
  selectedRepoId,
  onRepositorySelect,
  disabled = false,
  placeholder = 'Select a repository',
  error,
  securityContext,
  a11yProps = {},
  validationStatus
}) => {
  // Fetch GitHub data with security context
  const { 
    repositories,
    loading,
    error: githubError,
    fetchRepositories
  } = useGithub();

  // Validate repository access permissions
  const validateRepositoryAccess = useCallback((repository: GitHubRepository): boolean => {
    if (!securityContext) return false;

    const hasPermission = repository.permissions.pull && 
      securityContext.permissions.includes('READ');

    // Track security validation
    metrics.trackSecurityMetric(
      {
        type: 'repository_access_validation',
        severity: 'medium',
        details: {
          repositoryId: repository.id,
          hasAccess: hasPermission,
          userRole: securityContext.userRole
        },
        source: 'repo_selector'
      },
      {
        userId: securityContext.userId,
        sessionId: '', // Set by context
        userRole: securityContext.userRole,
        ipAddress: '', // Set by middleware
        timestamp: Date.now()
      }
    );

    return hasPermission;
  }, [securityContext]);

  // Filter and transform repositories for dropdown
  const dropdownOptions = useMemo(() => {
    return repositories
      .filter(repo => validateRepositoryAccess(repo))
      .map(repo => ({
        value: repo.id.toString(),
        label: repo.fullName
      }));
  }, [repositories, validateRepositoryAccess]);

  // Enhanced repository selection handler with security validation
  const handleRepositorySelect = useCallback((value: string | string[]) => {
    try {
      if (typeof value !== 'string') {
        throw new Error('Multiple selection not supported');
      }

      const repoId = parseInt(value, 10);
      const selectedRepo = repositories.find(r => r.id === repoId);

      if (!selectedRepo) {
        logger.warn('Invalid repository selection', { repoId });
        return;
      }

      if (!validateRepositoryAccess(selectedRepo)) {
        logger.error('Repository access denied', {
          repoId,
          userId: securityContext?.userId
        });
        return;
      }

      // Track successful selection
      metrics.trackUserActivity(
        'repository_selected',
        { repositoryId: repoId },
        {
          userId: securityContext?.userId || '',
          sessionId: '',
          userRole: securityContext?.userRole || '',
          ipAddress: '',
          timestamp: Date.now()
        }
      );

      onRepositorySelect(repoId);

    } catch (error) {
      logger.error('Repository selection failed', { error });
      onRepositorySelect(null);
    }
  }, [repositories, validateRepositoryAccess, onRepositorySelect, securityContext]);

  // Fetch repositories on mount and organization change
  useEffect(() => {
    const loadRepositories = async () => {
      try {
        await fetchRepositories(organization);
      } catch (error) {
        logger.error('Failed to fetch repositories', { error, organization });
      }
    };

    if (organization) {
      loadRepositories();
    }
  }, [organization, fetchRepositories]);

  // Compute error message with validation status
  const errorMessage = useMemo(() => {
    if (error) return error;
    if (githubError) return 'Failed to load repositories';
    if (validationStatus && !validationStatus.isValid) {
      return validationStatus.message || 'Invalid repository selection';
    }
    return undefined;
  }, [error, githubError, validationStatus]);

  return (
    <Dropdown
      label="Repository"
      value={selectedRepoId?.toString() || ''}
      options={dropdownOptions.map(opt => opt.value)}
      onChange={handleRepositorySelect}
      disabled={disabled || loading}
      error={Boolean(errorMessage)}
      helperText={errorMessage}
      placeholder={placeholder}
      ariaLabel={a11yProps.ariaLabel || 'Select GitHub repository'}
      ariaDescribedBy={a11yProps.ariaDescribedBy}
      reducedMotion={a11yProps.reducedMotion}
    />
  );
};

export default RepoSelector;