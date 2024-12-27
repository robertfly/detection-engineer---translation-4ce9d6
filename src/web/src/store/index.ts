// @reduxjs/toolkit version: ^1.9.7
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { persistStore, persistReducer } from 'redux-persist';
import runtimeCheck from 'redux-runtime-check';

// Import reducers
import authReducer from './authSlice';
import detectionReducer from './detectionSlice';
import translationReducer from './translationSlice';
import validationReducer from './validationSlice';
import githubReducer from './githubSlice';

// Import utilities
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Constants for store configuration
const REDUX_PERSIST_KEY = 'detection_translator_root';
const REDUX_PERSIST_VERSION = 1;

/**
 * Configure store middleware based on environment
 */
const configureMiddleware = (isDevelopment: boolean) => {
  // Initialize listener middleware for side effects
  const listenerMiddleware = createListenerMiddleware();

  // Base middleware array
  const middleware = [
    listenerMiddleware.middleware,
  ];

  // Development-only middleware
  if (isDevelopment) {
    // Add runtime type checking in development
    middleware.push(runtimeCheck({
      errorOnInvalidProp: true,
      errorOnMutableProp: true,
    }));

    // Add performance monitoring middleware
    middleware.push(store => next => action => {
      const start = performance.now();
      const result = next(action);
      const duration = performance.now() - start;

      metrics.trackUserActivity('redux_action', {
        action: action.type,
        duration,
        timestamp: new Date().toISOString()
      }, {
        userId: store.getState().auth?.user?.id || '',
        sessionId: '',
        userRole: store.getState().auth?.user?.roles?.[0] || '',
        ipAddress: '',
        timestamp: Date.now()
      });

      return result;
    });
  }

  return middleware;
};

// Root reducer configuration
const rootReducer = {
  auth: authReducer,
  detection: detectionReducer,
  translation: translationReducer,
  validation: validationReducer,
  github: githubReducer,
};

// Persist configuration
const persistConfig = {
  key: REDUX_PERSIST_KEY,
  version: REDUX_PERSIST_VERSION,
  storage: localStorage,
  whitelist: ['auth', 'detection'], // Only persist these reducers
  blacklist: ['translation', 'validation'], // Never persist these reducers
};

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';

// Configure and create store with middleware and persistence
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
      thunk: true,
    }).concat(configureMiddleware(isDevelopment)),
  devTools: isDevelopment,
});

// Create persistor
export const persistor = persistStore(store);

// Type definitions for TypeScript support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Custom hook for typed dispatch with error handling
 */
export const useAppDispatch = () => {
  const dispatch = useDispatch<AppDispatch>();
  return (action: any) => {
    try {
      return dispatch(action);
    } catch (error) {
      logger.error('Dispatch error', { error, action });
      throw error;
    }
  };
};

/**
 * Custom hook for typed selector with memoization support
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export store instance as default
export default store;