#!/bin/bash
# API Testing Guide for Active AI Subscriptions
# 
# This script provides example curl commands for testing all subscription endpoints
# Update BASE_URL and TOKEN variables before running

BASE_URL="http://localhost:3001"
# Get this from Clerk after signing in
TOKEN="your_clerk_jwt_token_here"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Active AI API Testing Guide ===${NC}\n"

# 1. Get Subscription Status
echo -e "${GREEN}1. GET /api/subscriptions/status${NC}"
echo "Purpose: Retrieve current user's subscription status"
echo "Command:"
echo "curl -H \"Authorization: Bearer $TOKEN\" \\"
echo "  $BASE_URL/api/subscriptions/status"
echo ""
echo "Expected Response:"
echo '{
  "subscription": {
    "id": "sub_123",
    "plan": "free",
    "status": "active",
    "currentPeriodEnd": null,
    "cancelledAt": null
  }
}'
echo -e "\n---\n"

# 2. Create Checkout Session
echo -e "${GREEN}2. POST /api/subscriptions/create-checkout${NC}"
echo "Purpose: Create a Stripe checkout session for premium upgrade"
echo "Command:"
echo "curl -X POST \\"
echo "  -H \"Authorization: Bearer $TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"priceId\": \"price_1O1234567890abcdef\",
    \"successUrl\": \"https://app.fitai.app/subscription/success\",
    \"cancelUrl\": \"https://app.fitai.app/subscription/cancel\"
  }' \\"
echo "  $BASE_URL/api/subscriptions/create-checkout"
echo ""
echo "Expected Response:"
echo '{
  "sessionId": "cs_test_123...",
  "url": "https://checkout.stripe.com/..."
}'
echo -e "\n---\n"

# 3. Create Billing Portal Session
echo -e "${GREEN}3. POST /api/subscriptions/billing-portal${NC}"
echo "Purpose: Create a Stripe billing portal for subscription management"
echo "Command:"
echo "curl -X POST \\"
echo "  -H \"Authorization: Bearer $TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"returnUrl\": \"https://app.fitai.app\"
  }' \\"
echo "  $BASE_URL/api/subscriptions/billing-portal"
echo ""
echo "Expected Response:"
echo '{
  "url": "https://billing.stripe.com/...",
  "created": 1234567890
}'
echo -e "\n---\n"

# 4. Webhook Testing
echo -e "${GREEN}4. Webhook Testing with Stripe CLI${NC}"
echo "Purpose: Test webhook event handling locally"
echo ""
echo "Step 1: Install Stripe CLI"
echo "  https://stripe.com/docs/stripe-cli"
echo ""
echo "Step 2: Login to your Stripe account"
echo "  $ stripe login"
echo ""
echo "Step 3: Forward webhook events"
echo "  $ stripe listen --forward-to localhost:3001/api/webhooks/stripe"
echo ""
echo "Step 4: In another terminal, trigger a test event"
echo "  $ stripe trigger customer.subscription.created"
echo "  $ stripe trigger customer.subscription.updated"
echo "  $ stripe trigger customer.subscription.deleted"
echo ""
echo "Expected: Webhook handler processes events and updates database"
echo -e "\n---\n"

# 5. Test Feature Gating
echo -e "${GREEN}5. Test Feature Gating (Free vs Premium)${NC}"
echo ""
echo "Test Case: Food Scanning (Free: 3/day limit)"
echo "Command:"
echo "curl -X POST \\"
echo "  -H \"Authorization: Bearer $TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"imageUrl\": \"...\"}' \\"
echo "  $BASE_URL/api/food/scan"
echo ""
echo "Expected for Free User (after 3 scans):"
echo '{
  "error": "Daily limit reached",
  "code": "limit_reached",
  "scansRemaining": 0
}'
echo ""
echo "Expected for Premium User:"
echo '{
  "meal": {
    \"id\": \"meal_123\",
    \"foodItems\": [...],
    \"totalCalories\": 450,
    \"macros\": {\"protein\": 25, \"carbs\": 50, \"fat\": 12}
  }
}'
echo -e "\n---\n"

# 6. Premium Feature Access
echo -e "${GREEN}6. Premium Features (Require Subscription)${NC}"
echo ""
echo "Example: Generate Meal Plan (Premium only)"
echo "Command:"
echo "curl -X POST \\"
echo "  -H \"Authorization: Bearer $TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{
    \"dayCount\": 7,
    \"targetCalories\": 2000
  }' \\"
echo "  $BASE_URL/api/nutrition/generate-meal-plan"
echo ""
echo "Expected Response (Premium):"
echo '{
  \"mealPlan\": {
    \"id\": \"plan_123\",
    \"days\": [...],
    \"totalCalories\": 14000
  }
}'
echo ""
echo "Expected Response (Free):"
echo '{
  \"error\": \"Premium subscription required\",
  \"code\": \"premium_required\",
  \"message\": \"Upgrade to access meal plans\"
}'
echo -e "\n---\n"

# 7. Manual Testing Steps
echo -e "${GREEN}7. Manual Testing Checklist${NC}"
echo ""
echo "Frontend Testing:"
echo "☐ Navigate to Pricing screen"
echo "☐ Verify Free tier shows 3/5 limits"
echo "☐ Verify Premium tier shows unlimited"
echo "☐ Click 'Upgrade Now' button"
echo "☐ Verify Stripe checkout opens"
echo "☐ Enter test card: 4242 4242 4242 4242"
echo "☐ Complete checkout"
echo "☐ Verify subscription status updates"
echo "☐ Verify Premium features unlock"
echo ""
echo "Backend Testing:"
echo "☐ Check Subscription created in database"
echo "☐ Verify Stripe webhook fired"
echo "☐ Test food scanning with 3+ scans"
echo "☐ Test meal plan generation (free user gets error)"
echo "☐ Upgrade to premium, retry meal plan"
echo "☐ Test billing portal opens"
echo "☐ Test cancellation flow"
echo -e "\n---\n"

# 8. Stripe Test Data
echo -e "${GREEN}8. Stripe Test Cards${NC}"
echo ""
echo "Visa (Success):"
echo "  Card: 4242 4242 4242 4242"
echo "  Expiry: Any future date (e.g., 12/25)"
echo "  CVC: Any 3 digits (e.g., 123)"
echo ""
echo "Visa Debit:"
echo "  Card: 4000 0566 5566 5556"
echo ""
echo "Mastercard:"
echo "  Card: 5555 5555 5555 4444"
echo ""
echo "American Express:"
echo "  Card: 3782 822463 10005"
echo "  CVC: 4 digits (e.g., 1234)"
echo ""
echo "3D Secure (Requires authentication):"
echo "  Card: 4000 0025 0000 3155"
echo ""
echo "Declined:"
echo "  Card: 4000 0000 0000 0002"
echo -e "\n---\n"

# 9. Debugging
echo -e "${GREEN}9. Debugging Tips${NC}"
echo ""
echo "Check webhook is configured:"
echo "  1. Go to stripe.com/account"
echo "  2. Navigate to Developers > Webhooks"
echo "  3. Verify endpoint URL"
echo "  4. Check recent events"
echo ""
echo "Check environment variables:"
echo "  echo \$STRIPE_SECRET_KEY"
echo "  echo \$STRIPE_WEBHOOK_SECRET"
echo ""
echo "View database subscription:"
echo "  SELECT * FROM \"Subscription\" WHERE \"userId\" = 'user_xyz';"
echo ""
echo "View API logs:"
echo "  npm run logs"
echo "  # or check function logs in Vercel/hosting platform"
echo -e "\n---\n"

# 10. Success Criteria
echo -e "${GREEN}10. Success Criteria${NC}"
echo ""
echo "✓ Users can view pricing page"
echo "✓ Users can create checkout session"
echo "✓ Stripe checkout page opens"
echo "✓ Payment succeeds with test card"
echo "✓ Webhook fires and updates database"
echo "✓ Subscription status updates in app"
echo "✓ Premium features unlock"
echo "✓ Free tier still has limits"
echo "✓ Billing portal opens"
echo "✓ Cancellation works"
echo ""
echo "All criteria met = Subscription system ready for production! 🚀"
