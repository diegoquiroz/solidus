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
    // 1. solidus_customers
    await queryInterface.createTable('solidus_customers', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      owner_type: { type: DataTypes.STRING, allowNull: false },
      owner_id: { type: DataTypes.STRING, allowNull: false },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true },
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_customers', ['owner_type', 'owner_id'], { transaction });
    await queryInterface.addIndex('solidus_customers', ['processor', 'processor_id'], { unique: true, transaction });

    // 2. solidus_charges
    await queryInterface.createTable('solidus_charges', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      customer_id: { type: DataTypes.UUID, allowNull: true },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      customer_processor_id: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.BIGINT, allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false },
      captured_at: { type: DataTypes.DATE, allowNull: true },
      receipt_url: { type: DataTypes.TEXT, allowNull: true },
      tax_amount: { type: DataTypes.BIGINT, allowNull: true },
      total_tax_amounts: { type: DataTypes.JSONB, allowNull: true },
      refund_total: { type: DataTypes.BIGINT, allowNull: true },
      payment_method_snapshot: { type: DataTypes.JSONB, allowNull: true },
      raw_payload: { type: DataTypes.JSONB, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_charges', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('solidus_charges', ['customer_id'], { transaction });
    await queryInterface.addIndex('solidus_charges', ['customer_processor_id'], { transaction });

    // 3. solidus_subscriptions
    await queryInterface.createTable('solidus_subscriptions', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      customer_id: { type: DataTypes.UUID, allowNull: true },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      customer_processor_id: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false },
      plan_code: { type: DataTypes.STRING, allowNull: true },
      price_id: { type: DataTypes.STRING, allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      cancel_at_period_end: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      current_period_start: { type: DataTypes.DATE, allowNull: true },
      current_period_end: { type: DataTypes.DATE, allowNull: true },
      trial_ends_at: { type: DataTypes.DATE, allowNull: true },
      paused_behavior: { type: DataTypes.STRING, allowNull: true },
      paused_resumes_at: { type: DataTypes.DATE, allowNull: true },
      raw_payload: { type: DataTypes.JSONB, allowNull: false },
      canceled_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_subscriptions', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('solidus_subscriptions', ['customer_id'], { transaction });
    await queryInterface.addIndex('solidus_subscriptions', ['customer_processor_id'], { transaction });

    // 4. solidus_payment_methods
    await queryInterface.createTable('solidus_payment_methods', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      customer_id: { type: DataTypes.UUID, allowNull: true },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      customer_processor_id: { type: DataTypes.STRING, allowNull: false },
      method_type: { type: DataTypes.STRING, allowNull: false },
      brand: { type: DataTypes.STRING, allowNull: true },
      last4: { type: DataTypes.STRING, allowNull: true },
      exp_month: { type: DataTypes.INTEGER, allowNull: true },
      exp_year: { type: DataTypes.INTEGER, allowNull: true },
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      raw_payload: { type: DataTypes.JSONB, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_payment_methods', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('solidus_payment_methods', ['customer_id'], { transaction });
    await queryInterface.addIndex('solidus_payment_methods', ['customer_processor_id'], { transaction });

    // 5. solidus_invoices
    await queryInterface.createTable('solidus_invoices', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      customer_processor_id: { type: DataTypes.STRING, allowNull: true },
      subscription_processor_id: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false },
      amount_due: { type: DataTypes.BIGINT, allowNull: true },
      amount_paid: { type: DataTypes.BIGINT, allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true },
      due_at: { type: DataTypes.DATE, allowNull: true },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      raw_payload: { type: DataTypes.JSONB, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_invoices', ['processor', 'processor_id'], { unique: true, transaction });

    // 6. solidus_webhook_events
    await queryInterface.createTable('solidus_webhook_events', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      processor: { type: DataTypes.STRING, allowNull: false },
      event_id: { type: DataTypes.STRING, allowNull: false },
      event_type: { type: DataTypes.STRING, allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false },
      received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processed_at: { type: DataTypes.DATE, allowNull: true },
      attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      next_attempt_at: { type: DataTypes.DATE, allowNull: true },
      last_error: { type: DataTypes.TEXT, allowNull: true },
      dead_lettered_at: { type: DataTypes.DATE, allowNull: true },
      failure_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_webhook_events', ['event_id', 'processor'], { unique: true, transaction });

    // 7. solidus_webhook_outbox
    await queryInterface.createTable('solidus_webhook_outbox', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      job_name: { type: DataTypes.STRING, allowNull: false },
      job_payload: { type: DataTypes.JSONB, allowNull: false },
      job_idempotency_key: { type: DataTypes.STRING, allowNull: true },
      run_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_webhook_outbox', ['run_at', 'processed_at'], { transaction });
    await queryInterface.addIndex('solidus_webhook_outbox', ['job_idempotency_key'], { unique: true, transaction });

    // 8. solidus_idempotency_keys
    await queryInterface.createTable('solidus_idempotency_keys', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      key: { type: DataTypes.STRING, allowNull: false },
      scope: { type: DataTypes.STRING, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_idempotency_keys', ['key', 'scope'], { unique: true, transaction });

    // 9. solidus_stripe_customers
    await queryInterface.createTable('solidus_stripe_customers', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      customer_id: { type: DataTypes.UUID, allowNull: true },
      processor: { type: DataTypes.STRING, allowNull: false },
      processor_id: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true },
      name: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      balance: { type: DataTypes.BIGINT, allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true },
      delinquent: { type: DataTypes.BOOLEAN, allowNull: true },
      invoice_prefix: { type: DataTypes.STRING, allowNull: true },
      raw_payload: { type: DataTypes.JSONB, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('solidus_stripe_customers', ['processor', 'processor_id'], { unique: true, transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tables = [
    'solidus_stripe_customers',
    'solidus_idempotency_keys',
    'solidus_webhook_outbox',
    'solidus_webhook_events',
    'solidus_invoices',
    'solidus_payment_methods',
    'solidus_subscriptions',
    'solidus_charges',
    'solidus_customers',
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

**Alternative:** Use the migration generator (optional):
```typescript
import { generateMigration } from '@diegoquiroz/solidus';

// Generates a timestamped migration file
const filepath = generateMigration('./migrations', {
  format: 'typescript',
  tablePrefix: 'solidus_',
});
console.log(`Migration created: ${filepath}`);
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

## Before/After Comparison

| Step | Old Approach (8 steps) | Zero-Config (3 steps) |
|------|------------------------|----------------------|
| 1 | Create 9 models manually | Install package |
| 2 | Copy SQL templates | Copy migration code |
| 3 | Create wrapper migration | Call `setupSolidus()` |
| 4 | Wire repository bundle | Done! |
| 5 | Create facade | |
| 6 | Configure webhooks | |
| 7 | Set up mixins | |
| 8 | Test integration | |

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

## Legacy Setup (Manual)

If you need the legacy manual setup approach (for advanced customization), see:
- [Legacy Configuration](2_configuration.md)
- [Migration from Legacy](migration-to-zero-config.md)

**Note:** The legacy approach is deprecated and will be removed in v2.0.
