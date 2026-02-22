# Installing Solidus

Solidus now offers a **zero-config setup** - get Stripe billing working in 2 steps instead of 8.

## Quick Setup (Zero-Config)

### Step 1: Install the package

```bash
npm install @diegoquiroz/solidus sequelize stripe
# or
yarn add @diegoquiroz/solidus sequelize stripe
# or
bun add @diegoquiroz/solidus sequelize stripe
```

### Step 2: Create Migrations

Like the `pay` gem, Solidus provides migration code for you to copy into your project. Create a migration file in your project's migrations folder:

**Using Sequelize CLI:**

```bash
npx sequelize-cli migration:generate --name create_solidus_tables
```

**Then copy this migration code:**

<details>
<summary>Click to expand migration code (TypeScript)</summary>

```typescript
import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // 1. solidus_merchants (pay_merchants equivalent)
    await queryInterface.createTable('solidus_merchants', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      owner_type: { type: DataTypes.STRING, allowNull: false },
      owner_id: { type: DataTypes.STRING, allowNull: false },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: true },
      default: { type: DataTypes.BOOLEAN, allowNull: true },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      type: { type: DataTypes.STRING, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_merchants', ['owner_type', 'owner_id'], { transaction });
    await queryInterface.addIndex('solidus_merchants', ['owner_type', 'owner_id', 'processor'], { transaction });

    // 2. solidus_customers (pay_customers equivalent)
    await queryInterface.createTable('solidus_customers', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      owner_type: { type: DataTypes.STRING, allowNull: false },
      owner_id: { type: DataTypes.STRING, allowNull: false },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: true },
      default: { type: DataTypes.BOOLEAN, allowNull: true },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      stripe_account: { type: DataTypes.STRING, allowNull: true },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
      type: { type: DataTypes.STRING, allowNull: true },
      object: { type: DataTypes.JSONB, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_customers', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('solidus_customers', {
      name: 'pay_customer_owner_index',
      fields: ['owner_type', 'owner_id', 'deleted_at'],
      unique: true,
      transaction,
    });

    // 3. solidus_payment_methods (pay_payment_methods equivalent)
    await queryInterface.createTable('solidus_payment_methods', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      customer_id: { type: DataTypes.BIGINT, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      default: { type: DataTypes.BOOLEAN, allowNull: true },
      payment_method_type: { type: DataTypes.STRING, allowNull: true },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      stripe_account: { type: DataTypes.STRING, allowNull: true },
      type: { type: DataTypes.STRING, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_payment_methods', ['customer_id', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('solidus_payment_methods', {
      name: 'ux_payment_methods_default_customer',
      fields: ['customer_id'],
      unique: true,
      where: { default: true },
      transaction,
    });

    // 4. solidus_subscriptions (pay_subscriptions equivalent)
    await queryInterface.createTable('solidus_subscriptions', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      customer_id: { type: DataTypes.BIGINT, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      processor_plan: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: DataTypes.STRING, allowNull: false },
      current_period_start: { type: DataTypes.DATE, allowNull: true },
      current_period_end: { type: DataTypes.DATE, allowNull: true },
      trial_ends_at: { type: DataTypes.DATE, allowNull: true },
      ends_at: { type: DataTypes.DATE, allowNull: true },
      metered: { type: DataTypes.BOOLEAN, allowNull: true },
      pause_behavior: { type: DataTypes.STRING, allowNull: true },
      pause_starts_at: { type: DataTypes.DATE, allowNull: true },
      pause_resumes_at: { type: DataTypes.DATE, allowNull: true },
      application_fee_percent: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      stripe_account: { type: DataTypes.STRING, allowNull: true },
      payment_method_id: { type: DataTypes.STRING, allowNull: true },
      type: { type: DataTypes.STRING, allowNull: true },
      object: { type: DataTypes.JSONB, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_subscriptions', ['customer_id', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('solidus_subscriptions', ['metered'], { transaction });
    await queryInterface.addIndex('solidus_subscriptions', ['pause_starts_at'], { transaction });

    // 5. solidus_charges (pay_charges equivalent)
    await queryInterface.createTable('solidus_charges', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      customer_id: { type: DataTypes.BIGINT, allowNull: false },
      subscription_id: { type: DataTypes.BIGINT, allowNull: true },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.BIGINT, allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: true },
      application_fee_amount: { type: DataTypes.BIGINT, allowNull: true },
      amount_refunded: { type: DataTypes.BIGINT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      stripe_account: { type: DataTypes.STRING, allowNull: true },
      type: { type: DataTypes.STRING, allowNull: true },
      object: { type: DataTypes.JSONB, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_charges', ['customer_id', 'processor_id'], { unique: true, transaction });

    // 6. solidus_webhooks (pay_webhooks equivalent with retry management)
    await queryInterface.createTable('solidus_webhooks', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      processor: { type: DataTypes.STRING, allowNull: true },
      event_id: { type: DataTypes.STRING, allowNull: true },
      event_type: { type: DataTypes.STRING, allowNull: true },
      event: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      type: { type: DataTypes.STRING, allowNull: true },
      attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      received_at: { type: DataTypes.DATE, allowNull: false },
      processed_at: { type: DataTypes.DATE, allowNull: true },
      next_attempt_at: { type: DataTypes.DATE, allowNull: true },
      last_error: { type: DataTypes.TEXT, allowNull: true },
      dead_lettered_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_webhooks', ['processor'], { transaction });
    await queryInterface.addIndex('solidus_webhooks', ['event_type'], { transaction });
    await queryInterface.addIndex('solidus_webhooks', ['created_at'], { transaction });
    await queryInterface.addIndex('solidus_webhooks', ['processor', 'event_id'], { unique: true, transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tables = [
    'solidus_webhooks',
    'solidus_charges',
    'solidus_subscriptions',
    'solidus_payment_methods',
    'solidus_customers',
    'solidus_merchants',
  ];

  for (const table of tables) {
    await queryInterface.dropTable(table);
  }
}
```

</details>

**Run the migration:**

```bash
npx sequelize-cli db:migrate
# or using Umzug, or your migration tool
```

### Step 3: Initialize Solidus

```typescript
import { setupSolidus } from '@diegoquiroz/solidus';
import { Sequelize } from 'sequelize';
import Stripe from 'stripe';

const sequelize = new Sequelize(/* your config */);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const solidus = await setupSolidus({
  sequelize,
  stripe,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});
```

That's it! Solidus is ready to use.

### Add Billing to Your Models

```typescript
import { solidusBilling } from '@diegoquiroz/solidus';
import { Model, DataTypes } from 'sequelize';

class User extends Model {
  declare id: string;
  declare email: string;
}

// Add billing capabilities
solidusBilling(User, { 
  ownerType: 'User', 
  getOwnerId: u => u.id 
});

// Use billing anywhere
const user = await User.findByPk('user-123');
await user.billing.charge({ amount: 1000, currency: 'usd' });
await user.billing.subscribe({ priceId: 'price_monthly' });
```

## Schema Changes from v1.x

The schema has been updated to match the Rails `pay` gem conventions:

### Key Changes

| Table | Changes |
|-------|---------|
| **merchants** | NEW - Connected accounts for Stripe Connect |
| **customers** | `processor_id` is now nullable, `is_default` renamed to `default`, added `type` (STI) and `object` columns, removed `email` and `metadata`, unique index on `(owner_type, owner_id, deleted_at)` |
| **charges** | Simplified to match pay_charges, added `subscription_id` FK, added `type` (STI) and `object` columns |
| **subscriptions** | Added `name`, `processor_plan`, `ends_at`, `pause_starts_at`, added `type` (STI) and `object` columns |
| **payment_methods** | Simplified, removed `processor` field, `method_type` renamed to `payment_method_type`, removed `brand`/`last4`/`exp_month`/`exp_year`, added `type` (STI) column |
| **webhooks** | Simplified to match pay_webhooks, added `type` (STI) column |

### Removed Tables

- `solidus_invoices` - Not in pay gem, use Stripe API for invoices
- `solidus_webhook_outbox` - Not in pay gem, implement your own queue
- `solidus_stripe_customers` - Merged into customers table

## Troubleshooting

### Migration already exists error

If you get an error about existing tables when running migrations:

- Check if you've already run the Solidus migration
- Use `migrateFromLegacy: true` if upgrading from manual setup
- See [Migration Guide](migration-to-zero-config.md) for upgrading existing databases

### TypeScript errors

Make sure your `tsconfig.json` has `esModuleInterop` enabled:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "strict": true
  }
}
```

### Webhook signature verification fails

Ensure your webhook route is mounted **before** `express.json()` middleware.

## Next Steps

- Read the [Getting Started](getting-started.md) guide for a complete walkthrough
- Check [Migration Guide](migration-to-zero-config.md) if upgrading from manual setup
- See [LLM Guide](llms/express-sequelize-typescript.md) for AI-assisted implementation
