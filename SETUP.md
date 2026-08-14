# Active AI - Setup & Development Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Deployment](#deployment)
7. [Common Issues](#common-issues)

## Project Overview

Active AI is a production-ready mobile fitness application with:
- React Native/Expo frontend
- Next.js backend
- PostgreSQL database
- AI-powered features (OpenAI + Anthropic)
- Stripe subscriptions
- Clerk authentication

## Prerequisites

### Required
- Node.js 18+ ([Download](https://nodejs.org/))
- npm 9+ or yarn/pnpm
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))
- Git

### Optional (for mobile development)
- Xcode (macOS, for iOS)
- Android Studio (for Android)
- Expo CLI: `npm install -g expo-cli`
- Docker & Docker Compose (for containerized dev)

## Local Development Setup

### 1. Clone & Install Dependencies

```bash
cd FitAI-Coach

# Install root dependencies
npm install

# Install workspace dependencies
npm install --workspaces
```

### 2. Environment Configuration

Copy environment template and configure:

```bash
cp .env.example .env.local

# Edit .env.local with your API keys:
# - CLERK_SECRET_KEY & CLERK_PUBLISHABLE_KEY
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - Database credentials (or use Docker)
```

### 3. Database Setup

#### Option A: Using Docker Compose (Recommended)

```bash
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Create .env.local with:
DATABASE_URL=postgresql://fitai:password@localhost:5432/fitai_coach
```

#### Option B: Local PostgreSQL

```bash
createdb fitai_coach
createuser fitai

# Set password and permissions
psql fitai_coach
ALTER ROLE fitai WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE fitai_coach TO fitai;
```

### 4. Backend Setup

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed database
npm run db:seed
```

### 5. Frontend Setup

```bash
cd ../frontend

# Download Expo modules
npx expo prebuild

# Optional: Create bare native projects
npx expo prebuild --clean
```

### 6. Start Development

#### Terminal 1 - Backend
```bash
cd backend
npm run dev
# API runs on http://localhost:3001
```

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
# Scan QR code with Expo app or iOS Simulator
```

#### Or Start Both Together
```bash
# From root directory
npm run dev
```

## Project Structure

```
FitAI-Coach/
├── backend/                    # Next.js API
│   ├── pages/api/             # API routes
│   ├── services/              # Business logic
│   ├── lib/                   # Utilities
│   ├── types/                 # TypeScript types
│   ├── prisma/                # Database schema
│   └── README.md
├── frontend/                   # React Native/Expo
│   ├── screens/               # UI screens
│   ├── navigation/            # Navigation setup
│   ├── services/              # API services
│   ├── components/            # Reusable components
│   └── README.md
├── shared/                     # Shared types & utilities
├── .env.example               # Environment template
├── docker-compose.yml         # Docker setup
├── package.json               # Workspaces config
└── README.md
```

## Development Workflow

### Adding a New Feature

1. **Create API Route** (Backend)
```typescript
// backend/pages/api/features/new-feature.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import { sendSuccess, sendError } from "@/lib/api-utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return sendError(res, "unauthorized", "", 401);

    // Implementation here

    sendSuccess(res, { /* data */ }, "Success");
  } catch (error) {
    console.error(error);
    sendError(res, "server_error", "", 500);
  }
}
```

2. **Create Service** (if needed)
```typescript
// backend/services/my-service.ts
export async function myService(params: any) {
  // Implementation
  return result;
}
```

3. **Update Database** (if needed)
```prisma
// backend/prisma/schema.prisma
model MyModel {
  id    String @id @default(cuid())
  // Fields
}
```

```bash
cd backend
npm run db:migrate
```

4. **Create Frontend Screen**
```typescript
// frontend/screens/my-feature/MyFeatureScreen.tsx
import React from "react";
import { View, Text } from "react-native";

export default function MyFeatureScreen() {
  return (
    <View className="flex-1 bg-gray-900 px-6 py-8">
      <Text className="text-white">My Feature</Text>
    </View>
  );
}
```

5. **Add Navigation** (if needed)
```typescript
// frontend/navigation/RootNavigator.tsx
// Add route to appropriate navigator
```

6. **Test Locally**
```bash
# Start dev servers
npm run dev

# Test API with curl or Postman
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/features/new-feature

# Test mobile app with Expo
# Scan QR code with Expo app
```

### Database Migrations

```bash
# Create new migration
cd backend
npm run db:migrate

# Reset database (caution!)
npx prisma migrate reset

# View database
npx prisma studio
```

### Type Safety

```bash
# Check TypeScript
npm run type-check

# Check specific workspace
npm run type-check --workspace=backend
```

## Deployment

### Vercel (Recommended for Backend)

```bash
# Connect your GitHub repo
# Backend auto-deploys from `backend/` directory
# Set environment variables in Vercel dashboard
```

### Firebase (Alternative Backend)

```bash
# Configure Firebase
firebase init

# Deploy
firebase deploy
```

### Mobile App Deployment

```bash
# Build for iOS
cd frontend
npm run build:ios

# Build for Android
npm run build:android

# Submit to stores via EAS
eas submit --platform ios
eas submit --platform android
```

## Common Issues

### Port Already in Use
```bash
# Backend port 3001
lsof -i :3001
kill -9 <PID>

# PostgreSQL port 5432
lsof -i :5432
kill -9 <PID>
```

### Database Connection Error
```bash
# Check PostgreSQL running
psql postgres -c "SELECT 1;"

# Verify DATABASE_URL in .env.local
# Format: postgresql://user:password@localhost:5432/database
```

### Expo Won't Connect
```bash
# Clear cache
npm run dev -- --clear

# Check local network access
# iOS: Settings > Expo > Allow Local Network

# Use tunnel instead of LAN
npx expo start --tunnel
```

### Prisma Client Issues
```bash
# Regenerate client
npm run db:generate --workspace=backend

# Clear cache
rm -rf node_modules/.prisma
npm install
```

### API 401 Errors
- Verify CLERK_SECRET_KEY is set
- Check JWT token in request headers
- Ensure user is authenticated in Clerk

### Tailwind Classes Not Working (Frontend)
```bash
# Ensure NativeWind is configured
npm install nativewind

# Clear cache
npx expo start --clear

# Restart dev server
```

## Monitoring & Debugging

### Backend Logging
- Add `console.error()` for debugging
- Check server logs in terminal
- Use Prisma Studio: `npx prisma studio`

### Frontend Debugging
- Use React DevTools
- Enable Debug Menu in Expo app
- Check network requests with Flipper

### Database Inspection
```bash
# Connect to database directly
psql fitai_coach -U fitai

# Or use Prisma Studio
npx prisma studio
```

## Next Steps

1. **Phase 1 Complete**: Authentication + Onboarding ✅
2. **Phase 2**: Body Assessment System
   - Upload photo handling
   - OpenAI vision integration
   - Assessment report generation

3. **Phase 3**: Food Scanner
   - Camera integration
   - Food recognition API
   - Nutrition calculations

4. **Phase 4**: Workout Generation
   - AI workout creation
   - Exercise library
   - Progressive overload

5. **Phase 5**: Nutrition Planning
   - Meal plan generation
   - Calorie calculations
   - Shopping list

6. **Phase 6**: AI Coach
   - Chat interface
   - Context awareness
   - Personalized coaching

7. **Phase 7**: Stripe Subscriptions
   - Payment processing
   - Subscription management
   - Premium features

8. **Phase 8**: Analytics & Scaling
   - PostHog integration
   - Admin dashboard
   - Performance optimization

## Support Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [React Native Docs](https://reactnative.dev)
- [Expo Docs](https://docs.expo.dev)
- [Clerk Docs](https://clerk.com/docs)

## License

Proprietary - Active AI
