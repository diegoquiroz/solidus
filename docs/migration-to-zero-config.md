# Migration to Zero-Config

This guide helps you migrate from the legacy manual setup (Solidus < 1.0) to the new Zero-Config approach introduced in US-006.

## Before/After Comparison

| Step | Old Approach (8 steps) | Zero-Config (2 steps) |
|------|------------------------|----------------------|
| 1 | Create 9 models manually | Install package |
| 2 | Copy SQL templates | Call `setupSolidus()` |
| 3 | Create wrapper migration | Done! |
| 4 | Wire repository bundle | |
| 5 | Create facade | |
| 6 | Configure webhooks | |
| 7 | Set up mixins | |
| 8 | Test integration | |

## Migration Steps

### 1. Remove Manual Boilerplate

Delete the manual wiring code from your application initialization.

**Remove:**
- `createSequelizeRepositoryBundleFromModels`
- `createSolidusFacade`
- `createStripeWebhookRouter`
- `createPersistFirstWebhookPipeline`
- Manual Sequelize model definitions for Solidus tables (e.g. `BillingCustomer`, `BillingCharge`, etc.)

### 2. Update Initialization

Replace the removed code with `setupSolidus`:

```typescript
import { setupSolidus } from '@diegoquiroz/solidus';

// ... setup sequelize and stripe ...

export const solidus = await setupSolidus({
  sequelize,
  stripe,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  // IMPORTANT: Set this to false if you already have tables
  // Set to true if you want Solidus to manage them going forward
  runMigrations: false, 
  // OPTIONAL: If you want to use existing tables but let Solidus manage them
  migrateFromLegacy: true, 
});
```

### 3. Update Webhook Mounting

Replace the custom webhook router with the one provided by `solidus`.

**Before:**
```typescript
app.use(
  "/solidus",
  createStripeWebhookRouter({
    express,
    stripe,
    // ... lots of config
  })
);
```

**After:**
```typescript
app.use("/solidus", solidus.express.webhookRouter);
```

### 4. Update Model Mixins

Ensure you are using `solidusBilling` on your owner models.

```typescript
import { solidusBilling } from '@diegoquiroz/solidus';

solidusBilling(User, {
  ownerType: 'User',
  getOwnerId: (user) => user.id,
});
```

## Schema Differences & Data Migration

The Zero-Config approach uses the same underlying schema structure but manages the models internally.

If you have existing tables created via the manual SQL templates:
1. They are compatible with Zero-Config models.
2. You can keep `runMigrations: false` to continue managing them manually.
3. OR you can set `runMigrations: true` and `migrateFromLegacy: true` to let Solidus take over ownership (it will check for existence before trying to create).

### Data Migration Example

If you need to move data from custom table names to standard Solidus table names (default prefix: `solidus_` if configured, or standard names if using default):

```typescript
// Example: Moving from 'my_app_charges' to 'solidus_charges'
await sequelize.query(`
  INSERT INTO solidus_charges (id, amount, currency, ...)
  SELECT id, amount, currency, ... FROM my_app_charges
`);
```

*Note: The standard SQL templates used in manual setup match the Zero-Config defaults, so data migration shouldn't be needed unless you customized table names.*

## Testing the Migration

1.  **Initialize:** Start your app and ensure `setupSolidus` completes without error.
2.  **Webhooks:** Trigger a test event (e.g., `payment_intent.succeeded`) and verify your webhook endpoint returns 200.
3.  **Billing:** Fetch a user and try to access `user.billing`.
4.  **Db Check:** Verify that a new charge or customer is correctly persisted to the database.
