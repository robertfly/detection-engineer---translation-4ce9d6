/**
 * Entry point of the React application implementing comprehensive provider configuration
 * with enhanced security, accessibility, and performance monitoring features.
 * @version 1.0.0
 */

// React imports - v18.2.0
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider } from '@mui/material';

// Internal imports
import App from './App';
import { store, persistor } from './store';
import GlobalStyles from './styles/global';
import { metrics } from './utils/metrics';
import { logger } from './utils/logger';

// Constants for configuration
const ROOT_ELEMENT_ID = 'root';
const PERFORMANCE_CONFIG = {
  environment: process.env.NODE_ENV,
  datadogClientToken: process.env.REACT_APP_DATADOG_CLIENT_TOKEN || '',
  datadogApplicationId: process.env.REACT_APP_DATADOG_APP_ID || '',
  enableRUM: true,
  enableWebVitals: true,
  sampleRate: 0.1,
  securityMode: {
    enableAuditTrail: true,
    encryptSensitiveData: true,
    sensitiveFields: ['accessToken', 'password'],
    retentionDays: 30
  },
  customTags: {
    app: 'detection-translator',
    version: '1.0.0'
  },
  enablePIIProtection: true,
  bufferConfig: {
    maxSize: 100,
    flushInterval: 5000,
    enableCompression: true
  }
};

/**
 * Initialize the application with security and performance monitoring
 */
const initializeApp = (): void => {
  try {
    // Initialize performance monitoring
    metrics.initializeMetrics(PERFORMANCE_CONFIG);

    logger.info('Application initialization started', {
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    });

    // Validate root element
    const rootElement = document.getElementById(ROOT_ELEMENT_ID);
    if (!rootElement) {
      throw new Error(`Root element #${ROOT_ELEMENT_ID} not found`);
    }

    // Create React root with concurrent features
    const root = ReactDOM.createRoot(rootElement);

    // Render application with providers
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <ThemeProvider>
              {/* Global styles with accessibility features */}
              <GlobalStyles />
              
              {/* Skip to main content link for accessibility */}
              <a 
                href="#main-content" 
                className="skip-to-content"
                tabIndex={0}
              >
                Skip to main content
              </a>

              {/* Main application component */}
              <App />
            </ThemeProvider>
          </PersistGate>
        </Provider>
      </React.StrictMode>
    );

    // Register service worker for PWA support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
          logger.error('Service worker registration failed', { error });
        });
      });
    }

    // Initialize keyboard navigation detection
    document.body.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        document.body.classList.add('user-is-tabbing');
      }
    });

    document.body.addEventListener('mousedown', () => {
      document.body.classList.remove('user-is-tabbing');
    });

    logger.info('Application initialized successfully');

  } catch (error) {
    logger.error('Application initialization failed', { error });
    // Display fallback UI for critical errors
    const rootElement = document.getElementById(ROOT_ELEMENT_ID);
    if (rootElement) {
      rootElement.innerHTML = `
        <div role="alert" style="padding: 20px; text-align: center;">
          <h1>Application Error</h1>
          <p>Sorry, the application failed to initialize. Please try refreshing the page.</p>
        </div>
      `;
    }
  }
};

// Initialize the application
initializeApp();