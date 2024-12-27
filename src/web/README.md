# AI-Driven Detection Translation Platform - Web Frontend

A modern, enterprise-grade web application for translating security detections between different SIEM platforms and detection languages using AI-powered translation capabilities.

## Project Overview

The web frontend provides an intuitive interface for security engineers to:
- Translate individual detection rules between supported formats
- Process batch translations via file upload or GitHub integration
- Validate and verify translation accuracy
- Manage detection rules with version control
- View detailed translation reports and analytics

### Supported Detection Formats
- Splunk SPL
- QRadar
- SIGMA
- Microsoft Azure KQL
- Palo Alto Networks
- Crowdstrike NG-SIEM
- YARA
- YARA-L

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Docker >= 24.0.0
- VSCode (recommended)

### Recommended VSCode Extensions
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Jest Runner
- Docker

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Start development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production-ready bundle
- `npm run preview` - Preview production build locally
- `npm run test` - Run unit tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking
- `npm run analyze` - Analyze bundle size

## Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── config/          # Configuration files
├── features/        # Feature-based modules
├── hooks/           # Custom React hooks
├── layouts/         # Page layouts
├── lib/            # Utility functions
├── pages/          # Route pages
├── services/       # API services
├── store/          # State management
├── styles/         # Global styles
└── types/          # TypeScript definitions
```

## Technology Stack

### Core Dependencies
- React 18.2.0
- TypeScript 5.0.0
- Material UI 5.14.0
- Redux Toolkit 1.9.5
- React Query 4.0.0
- Monaco Editor 0.45.0
- React Router 6.16.0

### Development Tools
- Vite 4.5.0
- Jest 29.7.0
- ESLint 8.49.0
- Prettier 3.0.0
- Husky 8.0.0

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome  | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |
| Edge    | 90+     |

## Accessibility

The application follows WCAG 2.1 Level AA standards:
- Full keyboard navigation support
- ARIA labels and roles
- Screen reader optimization
- High contrast mode support
- Responsive font sizing
- Focus management

## Security

### Best Practices
- Auth0 integration for authentication
- JWT token management
- XSS prevention
- CSRF protection
- Content Security Policy
- Secure HTTP headers

### Development Guidelines
- Regular dependency updates
- Security linting
- Input sanitization
- Secure data storage
- API request validation

## Performance

### Optimization Strategies
- Code splitting
- Lazy loading
- Image optimization
- Bundle size monitoring
- Caching strategies
- Performance monitoring

### Monitoring Tools
- Web Vitals
- Datadog RUM
- Lighthouse audits
- Bundle analyzer

## Development Workflow

1. Create feature branch from `develop`
2. Implement changes following style guide
3. Write tests (maintain >90% coverage)
4. Submit PR with description
5. Pass code review and checks
6. Merge to `develop`

## Deployment

### Build Process
1. Run tests and linting
2. Build production bundle
3. Generate source maps
4. Optimize assets
5. Create Docker image

### Environment Configuration
- Development: Local environment
- Staging: Pre-production testing
- Production: Live environment

## Troubleshooting

### Common Issues
1. Build failures
   - Clear node_modules and reinstall
   - Check Node.js version
   - Verify environment variables

2. Test failures
   - Update test snapshots
   - Check test environment
   - Verify mock data

3. Performance issues
   - Run bundle analysis
   - Check for memory leaks
   - Monitor API calls

### Debug Tools
- React DevTools
- Redux DevTools
- Network inspector
- Performance profiler

## Contributing

1. Follow coding standards
2. Write meaningful commit messages
3. Include tests for new features
4. Update documentation
5. Follow security guidelines

## License

Proprietary - All rights reserved

## Support

Contact: [support@company.com](mailto:support@company.com)