# Subscription System - Quick Reference

## What's Implemented

✅ **Free Tier**
- 3 food scans/day
- 5 AI coach messages/day
- Basic dashboard
- Progress photos
- Manual measurements

✅ **Premium Tier ($9.99/month)**
- Unlimited food scans
- Unlimited AI coach messages
- Full meal plans
- Complete workout library
- Weekly progress reviews
- Supplement recommendations

✅ **Payment Processing**
- Stripe integration
- Checkout flow
- Subscription webhooks
- Billing portal management

✅ **Feature Gating**
- Component-level restrictions
- API-level restrictions
- Middleware for limits

## Files Added

### Backend
```
backend/services/stripe-service.ts
backend/lib/subscription-middleware.ts
backend/pages/api/subscriptions/status.ts
backend/pages/api/subscriptions/create-checkout.ts
backend/pages/api/subscriptions/billing-portal.ts
backend/pages/api/webhooks/stripe.ts
```

### Frontend
```
frontend/screens/subscription/PricingScreen.tsx
frontend/screens/subscription/SubscriptionManagementScreen.tsx
frontend/components/FeatureGate.tsx
frontend/screens/profile/ProfileScreen.tsx (updated)
```

### Documentation
```
SUBSCRIPTIONS.md (complete guide)
```

## Key Features

### 1. Check Subscription Status

```typescript
// In any API route
import { getUserSubscription } from '@/lib/subscription-middleware';

const subscription = await getUserSubscription(req);
console.log(subscription.isPremium); // true or false
console.log(subscription.limits);    // { dailyFoodScans: 3, ... }
```

### 2. Gate Features in Frontend

```tsx
import FeatureGate from '@/components/FeatureGate';

<FeatureGate feature="unlimited_meals">
  <MealPlanScreen />
</FeatureGate>
```

### 3. Gate Features in Backend

```typescript
export default async function handler(req, res) {
  const subscription = await getUserSubscription(req);
  
  if (!subscription.isPremium) {
    return sendError(res, "premium_required", "", 403);
  }
  // Proceed with premium feature
}
```

### 4. Create Checkout Session

```bash
POST /api/subscriptions/create-checkout
{
  "priceId": "price_1O...",
  "successUrl": "https://...",
  "cancelUrl": "https://..."
}
```

### 5. Manage Billing

```bash
POST /api/subscriptions/billing-portal
{
  "returnUrl": "https://app.fitai.app"
}
```

## Stripe Configuration Checklist

- [ ] Create Stripe account
- [ ] Add payment method
- [ ] Create Premium product
- [ ] Create $9.99/month price
- [ ] Note down Price ID
- [ ] Configure webhook endpoint
- [ ] Add webhook signing secret
- [ ] Set environment variables:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- [ ] Test with test cards
- [ ] Deploy to production
- [ ] Switch to production keys

## Testing with Stripe

**Test Card:** 4242 4242 4242 4242
**Any future expiry date**
**Any CVC**

## Feature Limits

### Free Tier
| Feature | Free | Premium |
|---------|------|---------|
| Food Scans/Day | 3 | ∞ |
| Coach Messages/Day | 5 | ∞ |
| Meal Plans | ✗ | ✓ |
| Full Workouts | ✗ | ✓ |
| Progress Reviews | ✗ | ✓ |

## Integration Examples

### Add to Navigation

```tsx
// In RootNavigator.tsx
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
```

### Gate API Endpoint

```typescript
// backend/pages/api/nutrition/generate-meal-plan.ts
import { getUserSubscription } from '@/lib/subscription-middleware';

export default async function handler(req, res) {
  const subscription = await getUserSubscription(req);
  
  if (!subscription.limits.unlimitedMealPlans) {
    return sendError(res, "premium_required", "Upgrade to generate meal plans", 403);
  }

  // Generate meal plan
  const plan = await generateMealPlan(...);
  sendSuccess(res, plan);
}
```

### Show Upgrade Modal

```tsx
// In any screen
const { data: subscription } = useQuery({
  queryKey: ["subscription"],
  queryFn: () => axios.get(`${API_URL}/api/subscriptions/status`)
});

if (!subscription?.subscription?.isPremium) {
  return (
    <View className="bg-purple-900 p-4 rounded-lg">
      <Text className="text-white">Upgrade to Premium</Text>
      <TouchableOpacity onPress={() => navigation.navigate("Pricing")}>
        <Text className="text-green-400">Learn more</Text>
      </TouchableOpacity>
    </View>
  );
}
```

## Common Tasks

### Verify User is Premium

```typescript
const subscription = await getUserSubscription(req);
if (!subscription.isPremium) {
  throw new Error("Premium subscription required");
}
```

### Track Daily Usage

```typescript
const today = new Date().toDateString();
const todayScans = await prisma.meal.count({
  where: {
    userId,
    createdAt: { gte: new Date(today) }
  }
});

if (todayScans >= subscription.limits.dailyFoodScans) {
  throw new Error("Daily limit reached");
}
```

### Check Subscription Expiry

```typescript
const isExpired = subscription.currentPeriodEnd 
  ? new Date() > new Date(subscription.currentPeriodEnd)
  : false;

if (isExpired) {
  // Show renewal prompt
}
```

## Deployment Steps

1. **Stripe Setup**
   ```bash
   # Go to stripe.com/account/settings
   # Copy production API keys
   # Configure webhook
   ```

2. **Environment Variables**
   ```bash
   # Set in Vercel (or hosting)
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Database**
   ```bash
   # Migrate production database
   npm run db:migrate -- --deploy
   ```

4. **Deploy**
   ```bash
   git push origin main
   # Auto-deploys to Vercel
   ```

5. **Test**
   - Try upgrading on staging
   - Verify webhook fires
   - Check subscription in database
   - Test cancellation

## Troubleshooting

**Webhook not firing?**
- Check endpoint URL in Stripe Dashboard
- Verify webhook secret matches
- Check function logs for errors
- Test with `stripe trigger` command

**Subscription not updating?**
- Check metadata has userId
- Verify database insert/update
- Check webhook secret

**Payment failing?**
- Use Stripe test card: 4242 4242 4242 4242
- Check priceId exists in Stripe
- Verify API keys are correct

## Next Phases

### Phase 8+ Enhancements

1. **Usage Analytics**
   - Track feature usage per tier
   - Show usage in profile
   - Implement soft limits

2. **Trial Period**
   - 7-day free premium trial
   - Auto-upgrade to premium
   - Conversion tracking

3. **Promotions**
   - Discount codes
   - Family plans
   - Annual billing option

4. **Retention**
   - Churn analysis
   - Win-back campaigns
   - Custom retention offers

## Support Resources

- [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) - Full implementation guide
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)

---

**Subscription system is complete and production-ready!** 💳
