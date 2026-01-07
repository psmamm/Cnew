# Tradecircle - Agent Documentation

This document provides context and guidelines for AI agents working on the Tradecircle codebase.

## Project Overview

Tradecircle is a professional trading analytics and portfolio management platform. It features a React-based frontend and a Cloudflare Workers backend.

## Tech Stack

### Frontend (`src/react-app`)
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts, Lightweight Charts, TradingView Widget
- **State Management**: React Context & Hooks
- **Icons**: Lucide React

### Backend (`src/worker`)
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQL)
- **Storage**: Cloudflare R2
- **AI**: Cloudflare Workers AI

### Infrastructure & Auth
- **Auth**: Firebase Authentication (also references to Supabase, check `src/react-app/lib/`)
- **Deployment**: Cloudflare (Wrangler)

## Project Structure

The project follows a structure where frontend and backend coexist in `src/`.

- `/src/react-app/`: Frontend application code.
  - `components/`: React components.
  - `pages/`: Route components.
  - `hooks/`: Custom React hooks (data fetching, logic).
  - `contexts/`: React contexts (global state).
  - `lib/`: Third-party library configurations (Firebase, Supabase).
- `/src/worker/`: Backend Cloudflare Worker code.
  - `routes/`: API route handlers.
  - `utils/`: Backend utilities.
- `/src/shared/`: Shared types between frontend and backend.
- `/migrations/`: SQL migrations for D1 database.
- `/alles/`: **Caution**: This directory appears to contain a duplicate or legacy version of the project. **Prefer modifying code in the root `/src` directory unless explicitly instructed otherwise.**

## Development Guidelines

- **Package Manager**: `npm`
- **Scripts**:
  - `npm run dev`: Starts the development server.
  - `npm run build`: Builds the project.
  - `npm run check`: TypeScript check, build, and dry-run deploy.
  - `npm run cf-typegen`: Generates Cloudflare Worker types.

### Code Style
- Use **TypeScript** for all new code.
- Prefer **Functional Components** with Hooks for React.
- Use **Tailwind CSS** classes for styling.
- Ensure types are defined in `src/shared/types.ts` if used by both frontend and backend.

### Database
- The project uses Cloudflare D1 (SQLite-compatible).
- Schema changes should be reflected in `/migrations`.

## Context for Agents

- **Routing**: The frontend uses `react-router-dom`.
- **API**: The frontend communicates with the backend worker. Check `src/react-app/config/apiConfig.ts` or `src/react-app/hooks/useApi.ts` for API interaction patterns.
- **Authentication**: Authentication flow uses Firebase. Ensure strictly authorized access for protected routes.
