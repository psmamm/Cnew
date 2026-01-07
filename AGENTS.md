# AGENTS.md - AI Coding Agent Instructions

## Project Overview

**Tradecircle** is a professional trading analytics and portfolio management platform. It helps traders track trades, analyze performance, manage strategies, and participate in trading competitions.

## Tech Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7
- **Styling**: Tailwind CSS
- **Charts**: Recharts, Lightweight Charts, TradingView widgets
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **State**: React Context (AuthContext, ThemeContext, WalletContext, LanguageCurrencyContext)

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (for file uploads like trade screenshots)
- **AI**: Cloudflare Workers AI binding
- **Auth**: Dual authentication via Mocha Users Service and Firebase Auth

### Additional Services
- **Firebase**: Authentication (Google OAuth), Firestore (legacy)
- **Supabase**: Additional data services
- **Blockchain**: Solana Web3.js, Viem (EVM chains)

## Project Structure

```
/workspace/
├── src/
│   ├── react-app/           # Frontend React application
│   │   ├── App.tsx          # Main app with routes
│   │   ├── main.tsx         # Entry point
│   │   ├── components/      # React components
│   │   │   ├── auth/        # Authentication forms
│   │   │   ├── competition/ # Trading competition UI
│   │   │   ├── dashboard/   # Dashboard widgets
│   │   │   ├── markets/     # Market data components
│   │   │   ├── settings/    # User settings
│   │   │   ├── trading/     # Trading interface
│   │   │   ├── ui/          # Generic UI components
│   │   │   └── wizards/     # Multi-step wizards
│   │   ├── contexts/        # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Firebase/Supabase clients
│   │   ├── pages/           # Page components
│   │   │   └── competition/ # Competition feature pages
│   │   └── utils/           # Utility functions
│   ├── shared/
│   │   └── types.ts         # Shared TypeScript types (Zod schemas)
│   └── worker/              # Cloudflare Worker (backend)
│       ├── index.ts         # Main Hono app with routes
│       ├── routes/          # API route handlers
│       └── utils/           # Backend utilities
├── migrations/              # D1 database migrations (SQL files)
├── alles/                   # Additional feature modules
├── public/                  # Static assets
└── index.html               # HTML entry point
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (Vite + Cloudflare Workers)
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Type check and build verification
npm run check

# Generate Cloudflare types
npm run cf-typegen
```

## Code Conventions

### TypeScript
- Use strict TypeScript with proper typing
- Define shared types in `src/shared/types.ts` using Zod schemas
- Use type inference from Zod schemas: `type X = z.infer<typeof XSchema>`
- Avoid `any` - use proper typing or `unknown` with type guards

### React Components
- Use functional components with hooks
- Use named exports for components
- Keep components focused and single-purpose
- Use custom hooks in `hooks/` for reusable logic
- Prefer composition over inheritance

### Styling
- Use Tailwind CSS utility classes
- Follow the existing dark theme design
- Use `framer-motion` for animations
- Keep UI modern and professional

### API Routes (Hono)
- All API routes are under `/api/`
- Use the `combinedAuthMiddleware` for protected routes
- Return JSON responses with proper status codes
- Handle errors gracefully with informative messages
- Use Zod for request validation with `@hono/zod-validator`

### Database (D1)
- Use parameterized queries to prevent SQL injection
- Handle missing columns gracefully (migrations may not be applied)
- Use `CURRENT_TIMESTAMP` for timestamps
- Include `try/catch` blocks for database operations

## Authentication Pattern

The app supports dual authentication:

1. **Mocha Users Service**: OAuth via `@getmocha/users-service`
2. **Firebase Auth**: Direct Firebase authentication

The `combinedAuthMiddleware` in `src/worker/index.ts` handles both:

```typescript
// User ID is available via:
const userId = user.google_user_data?.sub || (user as any).firebase_user_id;
```

## Database Schema

Key tables in D1:
- `users` - User accounts and settings
- `trades` - Trade records with P&L tracking
- `strategies` - Trading strategies
- `exchange_connections` - Connected exchange APIs (encrypted)

Migrations are in `/migrations/` directory. The schema evolves, so always handle potentially missing columns.

## API Patterns

### Creating a new API route

1. Create route file in `src/worker/routes/`:
```typescript
import { Hono } from "hono";

const myRouter = new Hono();

myRouter.get("/", async (c) => {
  return c.json({ data: [] });
});

export { myRouter };
```

2. Register in `src/worker/index.ts`:
```typescript
import { myRouter } from "./routes/my-route";
app.route('/api/my-route', myRouter);
```

### Frontend API calls

Use the custom `useApi` hook or direct fetch:
```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  credentials: 'include', // Important for auth cookies
});
```

## Key Features

1. **Trade Journaling**: Log trades with entry/exit, P&L, notes, screenshots
2. **Strategy Management**: Create and track trading strategies
3. **Performance Analytics**: Dashboard with metrics, charts, reports
4. **Trading Competitions**: ELO-based matchmaking, tournaments
5. **Market Data**: Real-time crypto/forex/stock data
6. **Exchange Sync**: Connect Bybit and other exchanges
7. **Risk Management**: Daily loss limits, lockout features
8. **Gamification**: XP, ranks, streaks, reputation

## Environment Variables

The worker expects these bindings (configured in `wrangler.json`):
- `DB`: D1 Database binding
- `R2_BUCKET`: R2 storage binding  
- `AI`: Cloudflare Workers AI
- `MOCHA_USERS_SERVICE_API_URL`: Auth service URL
- `MOCHA_USERS_SERVICE_API_KEY`: Auth service key
- Various API keys for blockchain explorers

## Important Notes

1. **No long-running processes**: Cloudflare Workers have execution limits
2. **Cookie-based auth**: Use `credentials: 'include'` in fetch calls
3. **Graceful degradation**: Handle missing DB columns (migrations)
4. **Path aliases**: Use `@/` for imports from `src/` directory
5. **SPA routing**: The worker serves the SPA for all non-API routes

## Testing

Currently no automated test suite. Manual testing via:
- Development server (`npm run dev`)
- Build verification (`npm run check`)
- ESLint (`npm run lint`)

## Deployment

Deployed to Cloudflare Workers. The build process:
1. TypeScript compilation
2. Vite builds the React app
3. Wrangler deploys to Cloudflare

Firebase Hosting is also configured for static assets.

## Common Tasks

### Adding a new page
1. Create component in `src/react-app/pages/`
2. Add route in `src/react-app/App.tsx`
3. Use `ProtectedRoute` wrapper if authentication required

### Adding a new API endpoint
1. Create/update route in `src/worker/routes/`
2. Register route in `src/worker/index.ts`
3. Add types in `src/shared/types.ts` if needed

### Adding a database migration
1. Create new SQL file in `migrations/`
2. Include both schema changes and any data migrations
3. Handle gracefully if columns don't exist yet in queries

### Adding a new React hook
1. Create hook in `src/react-app/hooks/`
2. Follow naming convention: `useFeatureName.ts`
3. Export from file and import where needed
