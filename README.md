# Solidus

Solidus is a Stripe billing library for TypeScript backends, inspired by the ergonomics of the Ruby `pay` gem.

## Quick Start

### 1. Install

```bash
npm install @diegoquiroz/solidus sequelize stripe
```

### 2. Create Migration

Like the `pay` gem, copy the migration code into your project:

```bash
npx sequelize-cli migration:generate --name create_solidus_tables
```

Then copy the migration code from the [installation guide](docs/1_installation.md) and run:

```bash
npx sequelize-cli db:migrate
```

### 3. Setup Solidus

```typescript
import { setupSolidus, solidusBilling } from '@diegoquiroz/solidus';
import { Sequelize, Model, DataTypes } from 'sequelize';
import Stripe from 'stripe';

const sequelize = new Sequelize(/* config */);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const solidus = await setupSolidus({
  sequelize,
  stripe,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});

// Add billing to your model
class User extends Model {
  declare id: string;
  declare email: string;
}

solidusBilling(User, { ownerType: 'User', getOwnerId: u => u.id });

// Use billing anywhere
const user = await User.findByPk('user-123');
await user.billing.charge({ amount: 1000, currency: 'usd' });
await user.billing.subscribe({ priceId: 'price_monthly' });
```

That's it! Three steps to full Stripe billing.

## Payment Processor

- Stripe (current scope)

## Docs

- [Docs home](docs/index.md)
- [Express + Sequelize + TypeScript (LLM guide)](docs/llms/express-sequelize-typescript.md)
- [Migration from manual setup](docs/migration-to-zero-config.md)

### Quickstart (Zero-Config)

- [Installation](docs/1_installation.md) - Three-step setup
- [Getting Started](docs/getting-started.md) - Complete guide

### Legacy Documentation (Manual Setup)

- [Configuration](docs/2_configuration.md)
- [Customers](docs/3_customers.md)
- [Payment Methods](docs/4_payment_methods.md)
- [Charges](docs/5_charges.md)
- [Subscriptions](docs/6_subscriptions.md)
- [Routes & Webhooks](docs/7_webhooks.md)

### Reference

- `docs/facade-api.md`
- `docs/stripe-core-apis.md`
- `docs/express-webhooks.md`

### Operations and parity

- `docs/sequelize-express-production-hardening.md`
- `docs/webhook-operations-runbook.md`
- `docs/pay-stripe-parity-matrix.json`
- `docs/pay-parity-signoff-checklist.md`
