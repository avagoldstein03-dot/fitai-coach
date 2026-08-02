# Active AI Coach

Production-ready mobile fitness coaching application powered by AI.

## Project Structure

```
FitAI-Coach/
├── backend/              # Next.js API & services
├── frontend/             # React Native/Expo mobile app
├── shared/               # Shared types & utilities
├── .env.example          # Environment variables template
├── docker-compose.yml    # Local development setup
└── deployment/           # Production deployment configs
```

## Tech Stack

**Frontend:**
- React Native with Expo
- TypeScript
- NativeWind / Tailwind CSS

**Backend:**
- Next.js API routes
- PostgreSQL
- Prisma ORM
- TypeScript

**Services:**
- Authentication: Clerk
- Storage: AWS S3 / Cloudflare R2
- Payments: Stripe
- AI Providers: OpenAI + Anthropic Claude
- Analytics: PostHog
- Push Notifications: Firebase Cloud Messaging

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
cd backend && npm run db:migrate

# Start development servers
npm run dev
```

## Development Phases

### Phase 1: Authentication + Onboarding ✅
- User registration and login (Clerk)
- 8-step onboarding flow
- User profile setup
- **Status: Complete**

### Phase 2: Body Assessment ✅
- Photo-based body scan with OpenAI vision (images stored in S3)
- Manual measurement entry
- Body assessment reports
- **Status: Complete**

### Phase 3: Food Scanner ✅
- Food photo recognition
- Nutritional analysis
- Meal history tracking
- **Status: Complete**

### Phase 4: Workout Generation ✅
- AI-powered workout program creation
- Exercise library
- Progressive overload tracking
- **Status: Complete**

### Phase 5: Nutrition Planning ✅
- Personalized meal plans
- Calorie & macro calculations
- Shopping list generation
- **Status: Complete**

### Phase 6: AI Coach ✅
- Chat assistant with context awareness
- Progress analysis
- Behavioral coaching
- **Status: Complete**

### Phase 7: Subscriptions & Payments ✅
- Stripe subscription integration (web/Android) + RevenueCat/StoreKit (iOS)
- Free and Premium tiers
- Feature gating based on subscription
- **Status: Complete**

### Phase 8: Analytics & Scaling (partial)
- PostHog event tracking, admin dashboard, push notifications: done
- **Still open: automated tests/CI, performance/caching work**

## Key Features

✅ AI Body Assessment (photos + manual)
✅ AI Food Recognition
✅ Personalized Fitness Plans
✅ Personalized Nutrition Plans
✅ Supplement Recommendations
✅ Progress Tracking
✅ Coaching Chat Assistant
✅ Premium Subscriptions

## Subscription Tiers

### Free Tier
- 3 food scans per day
- 5 AI coach messages per day
- Basic dashboard
- Progress photo tracking
- Manual measurements

### Premium Tier ($9.99/month)
- Unlimited food scans
- Unlimited AI coach messages
- Full meal plan generation
- Complete workout library
- Weekly progress reviews
- Supplement recommendations
- Priority support

See [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) for complete implementation details.

## Security

- Account deletion purges DB records (cascade) and S3-hosted photos
- Self-serve data export endpoint
- Security headers (HSTS, CSP, X-Frame-Options, etc.) on all API routes
- Per-user rate limiting (Upstash) on AI/cost-sensitive endpoints
- Health/body data relies on Postgres-at-rest + TLS-in-transit encryption; no application-level field encryption yet
- Not yet done: automated tests/CI

## Documentation

- [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) - Complete subscription system guide
- [SUBSCRIPTIONS-QUICKREF.md](./SUBSCRIPTIONS-QUICKREF.md) - Quick reference
- [SETUP.md](./SETUP.md) - Development setup guide
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Architecture & implementation details
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [QUICKSTART.md](./QUICKSTART.md) - Quick reference commands

## Environment Variables

See `.env.example` for all required environment variables.

Key variables for subscriptions:
```
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## License

Proprietary - Active AI Coach
