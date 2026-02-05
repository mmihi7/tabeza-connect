# Technology Stack

## Build System & Package Management

- **Package Manager**: pnpm (v10.25.0+)
- **Build Tool**: Turbo (monorepo orchestration)
- **Workspace Structure**: pnpm workspaces with apps and packages

## Core Technologies

### Frontend
- **Framework**: Next.js 15+ (React 19)
- **Styling**: Tailwind CSS
- **PWA**: next-pwa for Progressive Web App functionality
- **Icons**: Lucide React, React Icons
- **TypeScript**: v5.3.3+

### Backend & Database
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for images and files
- **API**: Next.js API routes

### Testing
- **Unit Testing**: Jest with ts-jest
- **Property-Based Testing**: fast-check (especially for onboarding flow validation)
- **React Testing**: @testing-library/react
- **Integration Testing**: End-to-end onboarding flow testing
- **Visual Testing**: Playwright for onboarding UI consistency
- **Coverage**: Jest coverage reports

### Payment Integration
- **M-Pesa**: Daraja API integration with encrypted credential storage
- **Environment Support**: Sandbox and production environments

### Printer Integration
- **Thermal Printer Support**: ESC/POS compatible printers
- **Driver Requirements**: Tabeza printer drivers (available at tabeza.co.ke)
- **POS Integration**: Required for Basic mode and Venue mode with POS authority
- **Print Service**: Real-time receipt printing from POS systems

## Common Commands

### Development
```bash
# Start all apps in development mode
pnpm dev

# Start specific app
pnpm dev:customer  # Customer app on port 3002
pnpm dev:staff     # Staff app on port 3003

# Type checking across all packages
pnpm type-check
```

### Building & Deployment
```bash
# Build all applications
pnpm build

# Build specific app
pnpm build:customer
pnpm build:staff

# Start production builds
pnpm start
pnpm start:customer
pnpm start:staff
```

### Testing
```bash
# Run tests in shared package
cd packages/shared && pnpm test

# Run tests with coverage
cd packages/shared && pnpm test:coverage

# Watch mode for development
cd packages/shared && pnpm test:watch

# Run onboarding integration tests
node dev-tools/scripts/run-onboarding-integration-tests.js

# Run visual regression tests
node dev-tools/scripts/run-visual-tests.js
```

### Maintenance
```bash
# Lint all packages
pnpm lint

# Clean all build artifacts and node_modules
pnpm clean
```

## Environment Requirements

- **Node.js**: >=18.0.0
- **npm**: >=9.0.0
- **pnpm**: 10.25.0+ (specified in packageManager field)

## Deployment

- **Platform**: Vercel (configured with vercel.json files)
- **Build Output**: Standalone mode for staff app
- **PWA**: Service workers generated for offline functionality
- **Analytics**: Vercel Analytics and Speed Insights integrated