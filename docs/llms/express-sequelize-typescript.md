# LLM Guide: Express + Sequelize + TypeScript

This guide is for LLMs implementing Solidus inside an existing Express + Sequelize + TypeScript codebase.

Follow these steps for the modern **Zero-Config** setup.

## 0) Scope and assumptions

- Processor scope is Stripe.
- App stack is Express + Sequelize + TypeScript.
- You already have a DB connection.

## 1) Install dependencies

```bash
npm install @diegoquiroz/solidus sequelize stripe
```

## 2) Initialize Solidus (Zero-Config)

Do NOT manually create models or migrations. Use `setupSolidus`.

```typescript
import { setupSolidus } from '@diegoquiroz/solidus';
import { Sequelize } from 'sequelize';
import Stripe from 'stripe';

const sequelize = new Sequelize(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Initialize Solidus
// This handles:
// 1. Database models & migrations (runMigrations: true)
// 2. Webhook handling logic
// 3. Facade creation
export const solidus = await setupSolidus({
  sequelize,
  stripe,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  runMigrations: true,
});
```

## 3) Add Billing to Owner Model

Add the `solidusBilling` mixin to the model that will own subscriptions (e.g., User, Team, Organization).

```typescript
import { solidusBilling } from '@diegoquiroz/solidus';

// ... inside your model file ...

// Add billing capabilities
solidusBilling(User, {
  ownerType: 'User',
  getOwnerId: (user) => user.id,
});
```

## 4) Mount Webhooks

Mount the webhook router **before** any body parsers (like `express.json()`).

```typescript
import express from 'express';

const app = express();

// Mount Solidus webhook router
app.use('/webhooks/stripe', solidus.express.webhookRouter);

// Other middleware
app.use(express.json());
```

## 5) Usage Examples

### Create a Charge

```typescript
const user = await User.findByPk('...');
await user.billing.charge({
  amount: 2000,
  currency: 'usd',
  paymentMethodId: 'pm_card_visa',
});
```

### Create a Subscription

```typescript
await user.billing.subscribe({
  priceId: 'price_monthly',
  trialDays: 14,
});
```

### Customer Portal

```typescript
const url = await user.billing.createPortalSession({
  returnUrl: 'https://example.com/account',
});
```

## Verification Checklist

1.  **Tables Created:** Check that `solidus_customers`, `solidus_subscriptions`, etc., exist in the DB.
2.  **Webhooks Working:** Send a test event from Stripe Dashboard and ensure it returns 200 OK.
3.  **Owner Linked:** Create a customer/charge and verify `solidus_customers` has the correct `ownerId`.

## Legacy/Manual Setup

If the user specifically requests "manual setup" or "legacy configuration", refer to `docs/migration-to-zero-config.md` or older documentation, but default to this Zero-Config approach.
