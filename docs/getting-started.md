# Getting Started

This is the canonical quickstart for Solidus with Stripe, Express, and Sequelize-backed projections.

## 1) Install

```bash
bun add @diegoquiroz/solidus sequelize stripe
# or
npm install @diegoquiroz/solidus sequelize stripe
```

## 2) Configure environment variables

Set these values before booting your app:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Notes:
- Bun loads `.env` automatically.
- Ensure your `STRIPE_WEBHOOK_SECRET` matches the endpoint you configure in Stripe.

## 3) Initialize Solidus

Initialize Solidus with your Sequelize instance and Stripe client. This will automatically set up the required database tables and webhook handling.

```typescript
import { setupSolidus } from '@diegoquiroz/solidus';
import { Sequelize } from 'sequelize';
import Stripe from 'stripe';

const sequelize = new Sequelize(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const solidus = await setupSolidus({
  sequelize,
  stripe,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  runMigrations: true, // Automatically create tables if they don't exist
});
```

## 4) Add Billing to your Model

Enhance your User (or Team/Organization) model with billing capabilities.

```typescript
import { solidusBilling } from '@diegoquiroz/solidus';
import { Model, DataTypes } from 'sequelize';

class User extends Model {
  declare id: string;
  declare email: string;
}

User.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  email: DataTypes.STRING,
}, { sequelize, modelName: 'User' });

// Add billing mixin
solidusBilling(User, {
  ownerType: 'User',
  getOwnerId: (user) => user.id,
});
```

## 5) Create your first charge

Now you can use the billing API directly on your model instances.

```typescript
const user = await User.create({ id: 'user_123', email: 'test@example.com' });

// Create a one-off charge
const charge = await user.billing.charge({
  amount: 1000, // $10.00
  currency: 'usd',
  paymentMethodId: 'pm_card_visa', // Or use a token
});

console.log(`Charge successful: ${charge.id}`);
```

## 6) Set up Webhooks

Solidus handles webhooks automatically via the `solidus.express.webhookRouter`. Mount it **before** body parsers like `express.json()`.

```typescript
import express from 'express';

const app = express();

// Mount webhook router BEFORE body parsers
app.use('/webhooks/stripe', solidus.express.webhookRouter);

app.use(express.json());

app.listen(3000, () => console.log('Server running on port 3000'));
```

## 7) Next Steps

- **Subscriptions:** `await user.billing.subscribe({ priceId: 'price_...' })`
- **Customer Portal:** `await user.billing.createPortalSession()`
- **Production:** See [Production Hardening](sequelize-express-production-hardening.md)

## Troubleshooting

- **Migrations:** If `runMigrations: true` fails, ensure your database user has permission to create tables.
- **Webhooks:** If webhooks are failing, verify the `STRIPE_WEBHOOK_SECRET` and that the route is mounted before `express.json()`.
