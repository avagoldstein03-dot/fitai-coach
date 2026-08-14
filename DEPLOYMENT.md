# Active AI - Deployment Guide

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Mobile Apps (App Store & Play Store)          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │
┌──────────────────────┴──────────────────────────────────┐
│              Vercel CDN (Frontend Static)               │
└──────────────────────┬──────────────────────────────────┘
                       │ API Calls
                       │
┌──────────────────────┴──────────────────────────────────┐
│         Vercel Functions (Backend API)                  │
│         or AWS Lambda / Cloud Run                       │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼──┐   ┌────▼────┐   ┌──▼─────┐
    │AWS RDS │   │AWS S3   │   │Redis   │
    │PostgreSQL   │(Images) │   │(Cache) │
    └────────┘   └─────────┘   └────────┘
```

## Production Checklist

### Backend Deployment (Vercel)

#### 1. Prepare for Production

```bash
# Verify all environment variables
cat .env.example | grep -v "^#" | grep -v "^$"

# Test build
npm run build

# Check for errors
npm run type-check
npm run lint
```

#### 2. Configure Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Initialize project
vercel

# Follow prompts:
# - Link to Git repository
# - Select frontend/backend directories separately
```

#### 3. Environment Variables in Vercel Dashboard

Go to: https://vercel.com/dashboard → Project Settings → Environment Variables

Set:
```
NODE_ENV: production
DATABASE_URL: postgresql://user:pass@host/database
CLERK_SECRET_KEY: your_key
CLERK_PUBLISHABLE_KEY: your_key
OPENAI_API_KEY: your_key
ANTHROPIC_API_KEY: your_key
AWS_S3_REGION: us-east-1
AWS_S3_BUCKET: fitai-bucket
AWS_ACCESS_KEY_ID: your_key
AWS_SECRET_ACCESS_KEY: your_key
STRIPE_SECRET_KEY: your_key
STRIPE_PUBLISHABLE_KEY: your_key
STRIPE_WEBHOOK_SECRET: your_key
POSTHOG_API_KEY: your_key
FIREBASE_PROJECT_ID: your_id
FIREBASE_PRIVATE_KEY: your_key
FIREBASE_CLIENT_EMAIL: your_email
```

#### 4. Database Preparation

```bash
# Use AWS RDS for PostgreSQL
# Or use Railway, Supabase, etc.

# Configure connection pooling (PgBouncer)
# Set DATABASE_URL to pooled connection

# Run migrations in production
npm run db:migrate -- --deploy
```

#### 5. Deploy Backend

```bash
# Push to main branch triggers auto-deploy
git add .
git commit -m "Prepare for production"
git push origin main

# Verify deployment in Vercel dashboard
# Check API is responding
curl https://api.fitai.app/api/auth/profile \
  -H "Authorization: Bearer <test_token>"
```

### Frontend Deployment (App Store & Play Store)

#### 1. iOS App Store Deployment

```bash
cd frontend

# Build for production
npm run build:ios

# Set up Apple Developer account
# Create signing certificates in Xcode

# Configure EAS Build
eas build --platform ios --auto-submit

# Follow TestFlight review process
# Then submit to App Store
eas submit --platform ios
```

#### 2. Android Google Play Deployment

```bash
# Build for production
npm run build:android

# Set up Google Play Developer account
# Create signing key

# Build and submit
eas build --platform android --auto-submit
eas submit --platform android

# Follow review process
```

#### 3. Configure Expo Updates

```json
// frontend/app.json
{
  "expo": {
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/your-project-id"
    }
  }
}
```

### Database Setup (AWS RDS)

#### 1. Create RDS Instance

```bash
# Via AWS Console or CLI
aws rds create-db-instance \
  --db-instance-identifier fitai-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username fitai \
  --allocated-storage 20 \
  --publicly-accessible false
```

#### 2. Security Group Setup

```bash
# Allow only from Vercel IP ranges
# Allow connections on port 5432
# Restrict to your application servers
```

#### 3. Run Migrations

```bash
# Connect to RDS
DATABASE_URL=postgresql://user:pass@endpoint/fitai npm run db:migrate

# Verify schema
npm run db:generate
```

### Storage Setup (AWS S3)

#### 1. Create S3 Bucket

```bash
aws s3 mb s3://fitai-coach-images
```

#### 2. Configure Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::fitai-coach-images/*"
    }
  ]
}
```

#### 3. Enable CORS

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["https://*.fitai.app"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

### Stripe Setup

#### 1. Configure Account

- Create products for subscription plans
- Set up webhook endpoints
- Test payment flows

#### 2. Webhook Configuration

```bash
# Vercel endpoint:
https://api.fitai.app/api/webhooks/stripe

# Test webhook:
stripe trigger payment_intent.succeeded
```

### Monitoring & Logging

#### 1. PostHog Setup

```bash
# Create account at posthog.com
# Set API key in environment
# Add events to track
```

#### 2. Error Tracking (Sentry)

```bash
# Create account at sentry.io
npm install @sentry/nextjs

# Configure in app
```

#### 3. Application Monitoring

```bash
# Vercel Analytics: Auto-enabled
# Monitor at https://vercel.com/dashboard

# CloudWatch for AWS services
# Set up alarms for errors
```

### Domain & CDN

#### 1. Domain Configuration

```bash
# Point domain to Vercel nameservers
# Or configure CNAME records

# frontend.fitai.app -> vercel.com
# api.fitai.app -> vercel.com
```

#### 2. SSL/TLS

- Automatic with Vercel
- Renews every 90 days
- Verify HTTPS working

### Security Hardening

#### 1. API Security

```typescript
// Add rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Add CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

#### 2. Environment Variables

- Never commit secrets
- Use Vercel environment management
- Rotate keys regularly
- Use IAM roles for AWS access

#### 3. Database Security

- Enable encryption at rest
- Use connection SSL/TLS
- Enable backups
- Set up replication

#### 4. Application Security

- Keep dependencies updated
- Run security audits: `npm audit`
- Implement rate limiting
- Add request validation
- Use CORS properly

### Backup & Disaster Recovery

#### 1. Database Backups

```bash
# AWS RDS: Automatic daily backups
# Retention: 7-30 days
# Test restore procedures

# Manual backup:
pg_dump -h host -U user -d database | gzip > backup.sql.gz
```

#### 2. S3 Backups

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket fitai-coach-images \
  --versioning-configuration Status=Enabled

# Set up cross-region replication
```

#### 3. Disaster Recovery Plan

- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 1 hour
- Regular drills
- Document procedures

### Performance Optimization

#### 1. Frontend

```bash
# Analyze bundle size
npm run analyze

# Optimize images
npx image-optim-cli

# Code splitting
# Tree shaking
```

#### 2. Backend

```bash
# Database query optimization
# Analyze slow queries

# Cache strategies
# Redis for session/data caching

# API response compression
```

### Monitoring Dashboards

#### 1. Vercel Dashboard
- Function duration
- Error rates
- Request count
- Deployment history

#### 2. AWS CloudWatch
- RDS performance metrics
- S3 access patterns
- Lambda execution metrics

#### 3. Application Metrics
- User signups
- Feature usage
- API latency
- Error rates

### Post-Launch Checklist

- [ ] Test all features in production
- [ ] Monitor error rates (should be <0.1%)
- [ ] Check API response times (<500ms)
- [ ] Verify database backups working
- [ ] Test disaster recovery
- [ ] Validate payment processing
- [ ] Check mobile app performance
- [ ] Monitor server costs
- [ ] Set up alerts/notifications
- [ ] Document runbooks
- [ ] Schedule regular audits

### Cost Optimization

**Estimated Monthly Costs:**

| Service | Usage | Cost |
|---------|-------|------|
| Vercel | 100K requests | $20 |
| RDS PostgreSQL | t3.micro | $20 |
| S3 Storage | 100GB | $2 |
| S3 Requests | 1M | $5 |
| OpenAI API | 10K calls | $50 |
| Stripe | 2.9% + $0.30 | Variable |
| SendGrid/Email | 100K | $20 |
| **Total** | | **~$120-150** |

### Scaling Considerations

**Vertical Scaling:**
- Upgrade RDS instance type
- Increase database connections

**Horizontal Scaling:**
- Multiple API instances (auto-handled by Vercel)
- Database read replicas
- Caching layer (Redis)

**At 100K Users:**
- RDS: db.t3.small → db.m5.large
- Redis: Enable caching
- S3: Already scales infinitely
- Vercel: Auto-scales

### Incident Response Plan

1. **Monitor Alerts**
   - Error rates > 5%
   - Response time > 2s
   - Database connection errors

2. **Triage**
   - Check Vercel logs
   - Query CloudWatch
   - Check third-party status

3. **Remediation**
   - Scale resources if needed
   - Rollback if necessary
   - Implement fixes

4. **Post-Incident**
   - Document what happened
   - Update monitoring
   - Improve procedures

### Support & Maintenance

- Daily: Monitor metrics
- Weekly: Review logs & errors
- Monthly: Security updates
- Quarterly: Performance audit
- Annually: Disaster recovery test

---

**Deployment is the final step. Ensure Phase 1 testing is complete before deploying to production.**

Contact DevOps team for production deployment assistance.
