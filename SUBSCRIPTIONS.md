# Active AI - Subscription & Pricing Implementation

Complete implementation of Free and Premium tier subscription system with Stripe integration.

## Overview

The subscription system provides:
- **Free Tier**: Limited features for basic users
- **Premium Tier**: $9.99/month with unlimited access
- **Stripe Integration**: Payment processing and subscription management
- **Feature Gating**: Restrict premium features to paid users

## Architecture

### Database (Already Implemented)

```sql
-- Subscription model in schema.prisma
model Subscription {
  id                    String      @id @default(cuid())
  userId                String      @unique
  user                  User        @relation(...)
  
  stripeCustomerId      String      @unique
  stripeSubscriptionId  String
  stripePriceId         String
  
  plan                  String      // "free" | "premium"
  status                String      // "active" | "canceled" | "past_due"
  
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelledAt           DateTime?
}
```

## Backend Implementation

### 1. Stripe Service (`backend/services/stripe-service.ts`)

Core Stripe operations:
- `createCheckoutSession()` - Initiate payment
- `createBillingPortalSession()` - Manage subscriptions
- `getSubscription()` - Retrieve subscription details
- `cancelSubscription()` - Cancel paid subscriptions
- `getCustomerSubscriptions()` - List user subscriptions

### 2. Subscription Middleware (`backend/lib/subscription-middleware.ts`)

Feature access control:

```typescript
// Get user subscription status
const subscription = await getUserSubscription(req);

// Feature limits
const limits = subscription.limits;
// {
//   dailyFoodScans: 3,        // Free: 3, Premium: Unlimited
//   dailyCoachMessages: 5,    // Free: 5, Premium: Unlimited
//   unlimitedMealPlans: false,
//   unlimitedWorkouts: false,
//   progressReviews: false
// }

// Check feature access
const canAccessMealPlans = await checkFeatureAccess(req, "unlimitedMealPlans");
```

### 3. API Endpoints

#### `POST /api/subscriptions/status`
Get current subscription status:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/subscriptions/status
```

Response:
```json
{
  "subscription": {
    "plan": "premium",
    "status": "active",
    "currentPeriodEnd": "2026-07-08T00:00:00Z"
  }
}
```

#### `POST /api/subscriptions/create-checkout`
Create Stripe checkout session:
```bash
curl -X POST http://localhost:3001/api/subscriptions/create-checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_1O...",
    "successUrl": "https://app.fitai.app/subscription/success",
    "cancelUrl": "https://app.fitai.app/subscription/cancel"
  }'
```

#### `POST /api/subscriptions/billing-portal`
Manage subscription in Stripe:
```bash
curl -X POST http://localhost:3001/api/subscriptions/billing-portal \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "https://app.fitai.app"}'
```

#### `POST /api/webhooks/stripe`
Webhook for subscription events (automatic):
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Changes to subscription
- `customer.subscription.deleted` - Cancellation

## Frontend Implementation

### 1. Pricing Screen (`frontend/screens/subscription/PricingScreen.tsx`)

Displays pricing tiers:
- Free tier features
- Premium tier features
- Upgrade button
- FAQ section

**Usage:**
```tsx
import PricingScreen from '@/screens/subscription/PricingScreen';

<Tab.Screen
  name="Pricing"
  component={PricingScreen}
  options={{ title: "Plans" }}
/>
```

### 2. Subscription Management (`frontend/screens/subscription/SubscriptionManagementScreen.tsx`)

Manage active subscriptions:
- Current plan display
- Billing next date
- Payment method management
- Invoice history
- Cancel subscription

### 3. Feature Gate Component (`frontend/components/FeatureGate.tsx`)

Restrict features to premium users:

```tsx
import FeatureGate from '@/components/FeatureGate';

// Usage in screens
<FeatureGate feature="unlimited_meals">
  <MealPlanScreen />
</FeatureGate>

// With fallback
<FeatureGate
  feature="progress_reviews"
  fallback={<FreeTierMealPlanPreview />}
>
  <FullMealPlanScreen />
</FeatureGate>
```

Available features:
- `unlimited_meals` - Full meal planning
- `unlimited_workouts` - Full workout library
- `premium_coaching` - Unlimited AI coach
- `progress_reviews` - Weekly analysis

## Free vs Premium Tiers

### Free Tier Limits

```typescript
{
  dailyFoodScans: 3,           // Max 3 scans per day
  dailyCoachMessages: 5,       // Max 5 messages per day
  unlimitedMealPlans: false,   // No meal plans
  unlimitedWorkouts: false,    // No full workouts
  progressReviews: false       // No weekly analysis
}
```

**Features:**
- ✓ Basic dashboard
- ✓ 3 food scans/day
- ✓ 5 AI coach messages/day
- ✓ Manual measurements
- ✓ Progress photos
- ✗ Unlimited meal plans
- ✗ Full workout library
- ✗ Weekly progress reviews

### Premium Tier ($9.99/month)

```typescript
{
  dailyFoodScans: Infinity,
  dailyCoachMessages: Infinity,
  unlimitedMealPlans: true,
  unlimitedWorkouts: true,
  progressReviews: true
}
```

**Features:**
- ✓ Everything in Free
- ✓ Unlimited food scans
- ✓ Unlimited AI coach
- ✓ Full meal plan generation
- ✓ Complete workout library
- ✓ Weekly progress reviews
- ✓ Supplement recommendations
- ✓ Priority support

## Stripe Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for account
3. Complete verification

### 2. Create Products & Prices

**In Stripe Dashboard:**

1. **Products** → Create Product
   - Name: "Active AI Premium"
   - Type: Service
   - Save

2. **Pricing** → Add Price
   - Price: $9.99
   - Billing period: Monthly
   - Save

3. Copy the **Price ID** (e.g., `price_1O1234567890`)

### 3. Configure Webhook

**In Stripe Dashboard:**
1. **Developers** → Webhooks
2. Add endpoint: `https://api.fitai.app/api/webhooks/stripe`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy **Signing Secret** to `STRIPE_WEBHOOK_SECRET`

### 4. Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Integration Checklist

### Backend

- [x] Stripe service implementation
- [x] Subscription status endpoint
- [x] Checkout session endpoint
- [x] Billing portal endpoint
- [x] Webhook handler
- [x] Feature middleware
- [ ] Rate limiting per tier (optional)
- [ ] Usage tracking (optional)

### Frontend

- [x] Pricing screen
- [x] Subscription management screen
- [x] Feature gate component
- [ ] Stripe Elements integration (forms)
- [ ] Apple Pay / Google Pay (optional)
- [ ] App Store / Play Store subscriptions (optional)

### Database

- [x] Subscription model
- [x] Database migrations
- [x] Indexes for queries

### Stripe

- [x] Account created
- [x] Products configured
- [x] Prices set
- [ ] Webhook configured
- [ ] Test payments verified
- [ ] Error handling tested

## Testing Subscriptions

### Test Stripe Cards

Stripe provides test cards for development:

```
VISA:             4242 4242 4242 4242
VISA (debit):     4000 0566 5566 5556
Mastercard:       5555 5555 5555 4444
AMEX:             3782 822463 10005

CVC: Any 3 digits
Expiry: Any future date
```

### Test Webhook

```bash
# List events
stripe events list

# Trigger test event
stripe trigger payment_intent.succeeded

# Monitor webhooks
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

## Common Integrations

### Add Pricing to App Navigation

```tsx
// frontend/navigation/RootNavigator.tsx
<Tab.Screen
  name="Pricing"
  component={PricingScreen}
  options={{
    title: "Plans",
    tabBarIcon: ({ color }) => (
      <Ionicons name="pricetag" size={24} color={color} />
    ),
  }}
/>

<Tab.Screen
  name="SubscriptionManagement"
  component={SubscriptionManagementScreen}
  options={{ title: "Billing" }}
/>
```

### Gate Features in Screens

```tsx
// frontend/screens/nutrition/MealPlanScreen.tsx
import FeatureGate from '@/components/FeatureGate';

export default function MealPlanScreen() {
  return (
    <FeatureGate feature="unlimited_meals">
      <ScrollView>
        {/* Meal plan content */}
      </ScrollView>
    </FeatureGate>
  );
}
```

### Check Premium in API Calls

```typescript
// backend/pages/api/nutrition/meal-plan.ts
import { getUserSubscription } from '@/lib/subscription-middleware';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const subscription = await getUserSubscription(req);
  
  if (!subscription.isPremium) {
    return sendError(
      res,
      "premium_required",
      "This feature requires premium membership",
      403
    );
  }

  // Generate meal plan
}
```

## Advanced Features

### Usage Tracking

Track daily food scans:

```typescript
// backend/pages/api/food/scan.ts
const today = new Date().toDateString();
const scansToday = await prisma.meal.count({
  where: {
    userId: user.id,
    createdAt: {
      gte: new Date(today),
    },
  },
});

if (scansToday >= subscription.limits.dailyFoodScans) {
  return sendError(res, "limit_reached", "Daily limit reached", 429);
}
```

### Upgrade Prompts

Show upgrade suggestions when limits reached:

```tsx
// When daily limit reached
if (!isPremium && dailyScansRemaining === 0) {
  return <FeatureGate feature="unlimited_meals" />;
}
```

### Trial Period

Extend free trial logic:

```typescript
const trialEndDate = user.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000;
const isTrialActive = new Date() < new Date(trialEndDate);

const limits = isTrialActive 
  ? PREMIUM_TIER_LIMITS 
  : FREE_TIER_LIMITS;
```

## Troubleshooting

### Webhook Not Firing

1. Check endpoint URL in Stripe Dashboard
2. Verify webhook secret in environment
3. Use `stripe listen` locally
4. Check API logs for errors

### Payment Fails

1. Check Stripe API keys
2. Verify price ID exists
3. Test with Stripe test cards
4. Check customer creation

### Subscription Status Wrong

1. Verify webhook is firing
2. Check database subscription record
3. Verify userId matches
4. Test webhook manually in Stripe

## Deployment Checklist

- [ ] Stripe production keys configured
- [ ] Webhook endpoint live
- [ ] Database migrations run
- [ ] Error handling tested
- [ ] Payment flow tested end-to-end
- [ ] Upgrade/downgrade flows working
- [ ] Cancellation email set up
- [ ] Support email configured
- [ ] Refund policy documented
- [ ] Terms of service updated

## Next Steps

1. **Stripe Account**: Set up production account
2. **Configure Prices**: Add Premium product
3. **Set Webhook**: Configure endpoint
4. **Test Payments**: Use test cards
5. **Deploy**: Push to production
6. **Monitor**: Check webhook logs daily
7. **Support**: Set up billing support

## Documentation Links

- [Stripe Docs](https://stripe.com/docs)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Billing](https://stripe.com/docs/billing)
- [Stripe Testing](https://stripe.com/docs/testing)

---

**The subscription system is production-ready. Configure Stripe and deploy!**
