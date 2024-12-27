// @ts-check
import { defineConfig } from 'vite'; // ^4.5.0
import react from '@vitejs/plugin-react'; // ^4.1.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.1

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';

  return {
    // Configure plugins with optimized settings
    plugins: [
      react({
        // Enable Fast Refresh for rapid development
        fastRefresh: true,
        // Configure Babel for emotion styling
        babel: {
          plugins: ['@emotion/babel-plugin']
        }
      }),
      // Enable TypeScript path resolution
      tsconfigPaths()
    ],

    // Development server configuration
    server: {
      port: 3000,
      host: true,
      strictPort: true,
      // Enable CORS for development
      cors: true,
      // Hot Module Replacement settings
      hmr: {
        overlay: true
      },
      // Security headers
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    },

    // Production build configuration
    build: {
      outDir: 'dist',
      // Enable source maps for debugging
      sourcemap: isDevelopment,
      // Target modern browsers as per requirements
      target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
      // Increase chunk size warning limit for larger modules
      chunkSizeWarningLimit: 1000,
      // Rollup-specific options
      rollupOptions: {
        output: {
          // Optimize chunk splitting for better caching
          manualChunks: {
            // Core React bundle
            vendor: ['react', 'react-dom'],
            // Material UI bundle
            mui: ['@mui/material', '@mui/icons-material'],
            // State management bundle
            state: ['@reduxjs/toolkit', 'react-redux'],
            // Data fetching bundle
            query: ['@tanstack/react-query'],
            // Form handling bundle
            forms: ['react-hook-form', 'yup'],
            // Utility bundle
            utils: ['date-fns', 'lodash-es']
          }
        }
      },
      // Minification options
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDevelopment,
          drop_debugger: !isDevelopment
        }
      }
    },

    // Path resolution configuration
    resolve: {
      alias: {
        '@': '/src'
      }
    },

    // Environment variable handling
    define: {
      'process.env': process.env
    },

    // Dependency optimization
    optimizeDeps: {
      // Include dependencies for pre-bundling
      include: [
        'react',
        'react-dom',
        '@mui/material',
        '@mui/icons-material',
        '@reduxjs/toolkit',
        'react-redux',
        '@tanstack/react-query',
        'react-hook-form',
        'yup',
        'date-fns',
        'lodash-es'
      ],
      // Exclude test libraries from pre-bundling
      exclude: ['@testing-library/react']
    },

    // CSS handling
    css: {
      modules: {
        localsConvention: 'camelCase'
      },
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/styles/variables.scss";'
        }
      }
    },

    // Enable detailed build analysis in development
    ...(isDevelopment && {
      build: {
        rollupOptions: {
          plugins: [
            require('rollup-plugin-visualizer')({
              open: true,
              filename: 'stats.html'
            })
          ]
        }
      }
    })
  };
});