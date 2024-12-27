// react version: 18.2.0
// react-router-dom version: 6.14.0
import React, { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../common/Loading';
import { logger } from '../../utils/logger';
import { UserRole } from '../../interfaces/auth';

/**
 * Props for the ProtectedRoute component with enhanced security features
 */
interface ProtectedRouteProps {
  /** Child components to render when authenticated and authorized */
  children: React.ReactNode;
  /** Optional list of roles required to access the route */
  requiredRoles?: UserRole[];
  /** Whether MFA is required for this route */
  requireMFA?: boolean;
  /** Optional callback for unauthorized access attempts */
  onUnauthorized?: (reason: string) => void;
}

/**
 * Enhanced ProtectedRoute component implementing secure route protection with
 * role-based access control, MFA validation, and security monitoring
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requireMFA = false,
  onUnauthorized
}) => {
  const { isAuthenticated, isLoading, user, checkMFA } = useAuth();
  const location = useLocation();

  /**
   * Memoized authorization check with role hierarchy support
   */
  const isAuthorized = useMemo(() => {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!user || !user.roles || user.roles.length === 0) {
      return false;
    }

    // Check if user has any of the required roles
    // Role hierarchy: ADMIN > ENGINEER > ANALYST > READER
    const hasRequiredRole = requiredRoles.some(requiredRole => {
      if (user.roles.includes(UserRole.ADMIN)) {
        return true; // Admin has access to everything
      }

      if (requiredRole === UserRole.READER) {
        return user.roles.includes(UserRole.READER) ||
               user.roles.includes(UserRole.ANALYST) ||
               user.roles.includes(UserRole.ENGINEER);
      }

      if (requiredRole === UserRole.ANALYST) {
        return user.roles.includes(UserRole.ANALYST) ||
               user.roles.includes(UserRole.ENGINEER);
      }

      return user.roles.includes(requiredRole);
    });

    return hasRequiredRole;
  }, [requiredRoles, user]);

  /**
   * Handles unauthorized access with logging and custom callback
   */
  const handleUnauthorized = (reason: string) => {
    logger.warn('Unauthorized access attempt', {
      path: location.pathname,
      reason,
      userId: user?.id,
      roles: user?.roles
    });

    if (onUnauthorized) {
      onUnauthorized(reason);
    }

    return (
      <Navigate 
        to="/login" 
        state={{ from: location, reason }} 
        replace 
      />
    );
  };

  // Show loading state during authentication check
  if (isLoading) {
    return <Loading size="medium" message="Verifying access..." />;
  }

  // Check basic authentication
  if (!isAuthenticated) {
    return handleUnauthorized('Authentication required');
  }

  // Validate MFA if required
  if (requireMFA && !user?.mfaEnabled) {
    return handleUnauthorized('MFA verification required');
  }

  // Check role-based authorization
  if (!isAuthorized) {
    return handleUnauthorized('Insufficient permissions');
  }

  // Render protected content if all checks pass
  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

export default ProtectedRoute;