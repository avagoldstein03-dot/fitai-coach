# Active AI Backend

Next.js API backend with PostgreSQL and Prisma ORM.

## Project Structure

```
backend/
├── pages/
│   └── api/
│       ├── auth/              # Authentication endpoints
│       ├── onboarding/        # Onboarding flow (steps 1-8)
│       ├── assessment/        # Body assessment endpoints
│       ├── food/              # Food scanner endpoints
│       ├── nutrition/         # Nutrition plan endpoints
│       ├── workouts/          # Workout program endpoints
│       ├── chat/              # AI coach chat endpoints
│       ├── progress/          # Progress tracking endpoints
│       └── subscriptions/     # Stripe subscription endpoints
├── services/
│   ├── ai-provider.ts         # AI provider interface
│   ├── openai-provider.ts     # OpenAI implementation
│   ├── anthropic-provider.ts  # Anthropic Claude implementation
│   └── ai-registry.ts         # AI provider routing
├── lib/
│   ├── prisma.ts              # Prisma client
│   └── api-utils.ts           # API utilities
├── types/
│   └── index.ts               # TypeScript types
└── prisma/
    └── schema.prisma          # Database schema
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Environment variables configured

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Development

```bash
npm run dev
```

API runs on `http://localhost:3001`

### Building for Production

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/profile` - Get user profile

### Onboarding
- `POST /api/onboarding/step1` - Basic info (name, age, height, weight)
- `POST /api/onboarding/step2` - Goal selection
- `POST /api/onboarding/step3` - Activity level
- `POST /api/onboarding/step4` - Fitness experience
- `POST /api/onboarding/step5` - Diet preferences
- `POST /api/onboarding/step6` - Food allergies
- `POST /api/onboarding/step7` - Supplement history
- `POST /api/onboarding/step8` - Assessment method selection

## Database Schema

The Prisma schema includes models for:
- Users and authentication
- Body assessments and scans
- Meals and nutrition
- Workout programs and sessions
- Supplements
- Chat messages
- Subscriptions
- Analytics events

## AI Providers

The system supports multiple AI providers:

### OpenAI
- Food recognition and analysis
- Meal analysis
- Workout program generation
- Nutrition planning
- Real-time chat coaching

### Anthropic Claude
- Long-form assessment reports
- Progress reviews
- Weekly summaries
- Behavioral coaching
- Goal adjustment recommendations

## Environment Variables

See `../.env.example` for required configuration:
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk authentication
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `AWS_S3_*` - AWS S3 configuration
- `STRIPE_*` - Stripe configuration
- `FIREBASE_*` - Firebase configuration

## Testing

```bash
npm run type-check  # TypeScript checking
npm run lint        # ESLint
```

## Deployment

The backend is designed to be deployed on:
- Vercel (native Next.js support)
- AWS Lambda
- Docker containers
- Traditional Node.js servers

## Architecture

The API follows a modular architecture:
1. **API Routes** - HTTP endpoints
2. **Services** - Business logic and AI integration
3. **Database** - Prisma ORM for data persistence
4. **Types** - Shared TypeScript definitions

## Security

- User authentication via Clerk
- HTTPS required in production
- Database encryption for sensitive data
- GDPR compliance features
- Account deletion support
- Data export functionality
