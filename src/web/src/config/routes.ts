/**
 * @fileoverview Enhanced routing configuration with security, accessibility, and analytics features.
 * Implements protected routes, path mappings, and route metadata for the detection translation platform.
 * @version 1.0.0
 */

import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import Dashboard from '../pages/Dashboard';
import SingleTranslation from '../pages/SingleTranslation';
import BatchTranslation from '../pages/BatchTranslation';
import GitHubIntegration from '../pages/GitHubIntegration';

/**
 * Enhanced route configuration interface with accessibility and analytics
 */
export interface RouteConfig {
  /** Route path */
  path: string;
  /** Route component */
  element: React.ReactNode;
  /** Whether route requires authentication */
  protected: boolean;
  /** Route title for navigation */
  title: string;
  /** Analytics tracking ID */
  analyticsId: string;
  /** Accessibility label */
  accessibilityLabel: string;
  /** Whether to enable error boundary */
  errorBoundary?: boolean;
}

/**
 * Application route path constants
 */
export const ROUTES = {
  DASHBOARD: '/dashboard',
  SINGLE_TRANSLATION: '/translate/single',
  BATCH_TRANSLATION: '/translate/batch',
  GITHUB_INTEGRATION: '/github',
  LOGIN: '/login',
  SETTINGS: '/settings',
  NOT_FOUND: '*',
  SERVER_ERROR: '/500'
} as const;

/**
 * Creates a protected route with enhanced security and accessibility features
 */
const createProtectedRoute = (config: RouteConfig): RouteObject => ({
  path: config.path,
  element: (
    <ProtectedRoute
      requiredRoles={['ADMIN', 'ENGINEER', 'ANALYST']}
      requireMFA={true}
      onUnauthorized={(reason) => {
        // Track unauthorized access attempts
        logger.warn('Unauthorized route access', {
          path: config.path,
          reason,
          timestamp: new Date()
        });
      }}
    >
      {config.element}
    </ProtectedRoute>
  ),
  errorElement: config.errorBoundary ? <ErrorBoundary /> : undefined
});

/**
 * Creates a public route with analytics and accessibility features
 */
const createPublicRoute = (config: RouteConfig): RouteObject => ({
  path: config.path,
  element: config.element,
  errorElement: config.errorBoundary ? <ErrorBoundary /> : undefined
});

/**
 * Application route configuration with security and accessibility enhancements
 */
export const routes: RouteObject[] = [
  // Dashboard route
  createProtectedRoute({
    path: ROUTES.DASHBOARD,
    element: <Dashboard />,
    protected: true,
    title: 'Dashboard',
    analyticsId: 'dashboard_view',
    accessibilityLabel: 'Detection Translation Dashboard',
    errorBoundary: true
  }),

  // Single Translation route
  createProtectedRoute({
    path: ROUTES.SINGLE_TRANSLATION,
    element: <SingleTranslation />,
    protected: true,
    title: 'Single Translation',
    analyticsId: 'single_translation_view',
    accessibilityLabel: 'Single Detection Translation',
    errorBoundary: true
  }),

  // Batch Translation route
  createProtectedRoute({
    path: ROUTES.BATCH_TRANSLATION,
    element: <BatchTranslation />,
    protected: true,
    title: 'Batch Translation',
    analyticsId: 'batch_translation_view',
    accessibilityLabel: 'Batch Detection Translation',
    errorBoundary: true
  }),

  // GitHub Integration route
  createProtectedRoute({
    path: ROUTES.GITHUB_INTEGRATION,
    element: <GitHubIntegration />,
    protected: true,
    title: 'GitHub Integration',
    analyticsId: 'github_integration_view',
    accessibilityLabel: 'GitHub Repository Integration',
    errorBoundary: true
  }),

  // Settings route
  createProtectedRoute({
    path: ROUTES.SETTINGS,
    element: lazy(() => import('../pages/Settings')),
    protected: true,
    title: 'Settings',
    analyticsId: 'settings_view',
    accessibilityLabel: 'Application Settings',
    errorBoundary: true
  }),

  // Login route (public)
  createPublicRoute({
    path: ROUTES.LOGIN,
    element: lazy(() => import('../pages/Login')),
    protected: false,
    title: 'Login',
    analyticsId: 'login_view',
    accessibilityLabel: 'Login Page',
    errorBoundary: true
  }),

  // Error routes
  createPublicRoute({
    path: ROUTES.NOT_FOUND,
    element: lazy(() => import('../pages/NotFound')),
    protected: false,
    title: '404 Not Found',
    analyticsId: '404_error_view',
    accessibilityLabel: 'Page Not Found',
    errorBoundary: false
  }),

  createPublicRoute({
    path: ROUTES.SERVER_ERROR,
    element: lazy(() => import('../pages/ServerError')),
    protected: false,
    title: '500 Server Error',
    analyticsId: '500_error_view',
    accessibilityLabel: 'Server Error Page',
    errorBoundary: false
  })
];

export default routes;