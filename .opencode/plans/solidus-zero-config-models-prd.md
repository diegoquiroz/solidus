# PRD: Solidus Zero-Config Models (Pay Gem Ergonomics)

## Overview

**Problem:** Solidus currently requires users to manually create 9-10 Sequelize models, copy SQL migration templates, and wire up repository bundles. This is ~8 steps of setup friction compared to Pay gem's ~2 steps.

## Current State Assessment

### ✅ Already Implemented

After investigation, I found that **Phase 7 (Pay-style model ergonomics) was already implemented** in the codebase:

**1. Global Facade System** (`src/packages/core/global-facade.ts`)
```ts
import { Solidus } from '@diegoquiroz/solidus';

Solidus.configure({
  createFacade,
  stripe,
  repositories,
});

const facade = Solidus.getFacade(); // Works anywhere in your app
```

**2. Model Mixins** (`src/packages/core/model-extension.ts`)
```ts
import { createBillingMixin } from '@diegoquiroz/solidus';

const billingMixin = createBillingMixin<Workspace>({
  ownerType: 'Workspace',
  getOwnerId: (w) => w.id,
});

const workspace = await Workspace.findByPk(id);
const billing = billingMixin(workspace);
await billing.charge({ amount: 1000, currency: 'usd' });
```

**3. Repository Pattern** (`src/packages/sequelize/repositories.ts`)
```ts
const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: BillingCustomer,  // User must create these manually
  charges: BillingCharge,
  // ... etc
});
```

### ❌ What's Missing (The Gap)

The **mixins and global facade exist**, but users still need to:

1. **Create 9 Sequelize models manually** - No built-in model definitions provided
2. **Wire up repository bundle explicitly** - Must pass models to `createSequelizeRepositoryBundleFromModels`
3. **Copy SQL migration templates** - No programmatic migration helpers

### The Complete Picture

**Current Pattern (Still requires manual work):**
```ts
// 1. User creates 9 models manually
class BillingCustomer extends Model {}
class BillingCharge extends Model {}
// ... 7 more models

// 2. User wires up repositories
const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: BillingCustomer,
  charges: BillingCharge,
  // ... etc
});

// 3. User configures global facade
Solidus.configure({
  createFacade,
  stripe,
  repositories: repositoryBundle.facade,
  ownerCustomers: repositoryBundle.core.customers,
});

// 4. User can then use mixins
const billingMixin = createBillingMixin({ ownerType: 'Workspace', getOwnerId: w => w.id });
const workspace = await Workspace.findByPk(id);
const billing = billingMixin(workspace);
await billing.charge({...});
```

**Target Pattern (Zero-config):**
```ts
// 1. One-line setup - Solidus provides models, auto-wires everything
const solidus = await setupSolidus({
  sequelize,
  stripe,
  runMigrations: true,
});

// 2. Use immediately - models and facade ready to use
const workspace = await Workspace.findByPk(id);
await workspace.billing.charge({ amount: 1000, currency: 'usd' });
```

**Solution:** Provide built-in Sequelize model definitions that integrate with the existing global facade and mixin system. The infrastructure (facade, mixins) is already there - we just need the models and auto-wiring layer.

**Reference Implementation:** 
- Pay gem uses Rails Engine with built-in ActiveRecord models in `app/models/pay/`
- Models use STI pattern for multi-processor support (`Pay::Stripe::Customer`)
- Migrations are copied via generator: `rails pay:install:migrations`
- User calls `pay_customer` in their model to enable billing

**Current Solidus Pattern (Manual):**
```ts
// 1. User must create all models manually
class BillingCustomer extends Model {}
class BillingCharge extends Model {}
// ... 7 more models

// 2. User must wire up repository bundle
const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: BillingCustomer,
  charges: BillingCharge,
  // ... etc
});

// 3. User must create facade
const facade = createSolidusFacade({
  stripe,
  repositories: repositoryBundle.facade,
  ownerCustomers: repositoryBundle.core.customers,
});

// 4. User can then use mixin
const billingMixin = createBillingMixin({ ownerType: 'Workspace', getOwnerId: w => w.id });
```

**Target Pattern (Zero-Config):**
```ts
// 1. Initialize built-in models
const models = initializeSolidusModels(sequelize);

// 2. Configure global facade (auto-wires repositories from models)
Solidus.configure({
  createFacade,
  stripe,
  models, // Auto-wires all repositories
});

// 3. Use mixin immediately
const workspace = await Workspace.findByPk(id);
await workspace.billing.charge({ amount: 1000, currency: 'usd' });
```

## Goals

1. Reduce Solidus setup from ~8 steps to ~2 steps
2. Provide Pay gem-equivalent ergonomics: `workspace.charge()`, `workspace.subscribe()`
3. Eliminate manual model creation and repository wiring
4. Maintain TypeScript type safety and IntelliSense support
5. Support Stripe (current scope) with extensibility for future processors

## Quality Gates

These commands must pass for every user story:
- `bun test` - All tests pass
- `bun run typecheck` - TypeScript type checking (if available)

## User Stories

### US-001: Create built-in Solidus Sequelize models ⭐ FOUNDATION

**Description:** As a developer, I want Solidus to provide ready-to-use Sequelize models so I don't have to create them manually.

**Acceptance Criteria:**
- [ ] Create `src/packages/sequelize/models/` directory with model definitions:
  - `SolidusCustomer.ts` - Owner-to-processor customer links
  - `SolidusCharge.ts` - Charge/payment records
  - `SolidusSubscription.ts` - Subscription records
  - `SolidusPaymentMethod.ts` - Stored payment methods
  - `SolidusInvoice.ts` - Invoice projections
  - `SolidusWebhookEvent.ts` - Webhook event tracking
  - `SolidusWebhookOutbox.ts` - Webhook processing queue
  - `SolidusIdempotencyKey.ts` - Idempotency key storage
  - `SolidusStripeCustomer.ts` - Stripe customer projections
- [ ] Models use `tableName` prefix: `solidus_` (e.g., `solidus_customers`)
- [ ] Models define all columns from schema spec
- [ ] Models support both Sequelize v6 and v7 import patterns
- [ ] Export models from `src/packages/sequelize/index.ts`

**Key Files to Reference:**
- Schema spec: `packages/sequelize/src/schema.ts`
- Current model interface: `src/packages/sequelize/repositories.ts` (lines 138-145)
- Migration template: `packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.up.sql`

### US-002: Create model initialization function ⭐ CORE API

**Description:** As a developer, I want a single function to initialize all Solidus models with my Sequelize instance.

**Acceptance Criteria:**
- [ ] Create `initializeSolidusModels(sequelize: Sequelize, options?)` function
- [ ] Function registers all models with the provided Sequelize instance
- [ ] Function sets up model associations (hasMany, belongsTo)
- [ ] Function returns object with initialized model classes:
  ```ts
  {
    Customer: typeof SolidusCustomer,
    Charge: typeof SolidusCharge,
    Subscription: typeof SolidusSubscription,
    PaymentMethod: typeof SolidusPaymentMethod,
    Invoice: typeof SolidusInvoice,
    WebhookEvent: typeof SolidusWebhookEvent,
    WebhookOutbox: typeof SolidusWebhookOutbox,
    IdempotencyKey: typeof SolidusIdempotencyKey,
    StripeCustomer: typeof SolidusStripeCustomer,
  }
  ```
- [ ] Accept optional configuration:
  - `tablePrefix?: string` - default: `'solidus_'`
  - `schema?: string` - database schema (PostgreSQL)
- [ ] Handle association setup order (parent models first)

**Usage Example:**
```ts
import { Sequelize } from 'sequelize';
import { initializeSolidusModels } from '@diegoquiroz/solidus';

const sequelize = new Sequelize(/* ... */);
const models = initializeSolidusModels(sequelize);

// Models are now registered with Sequelize
await sequelize.sync();
```

### US-003: Integrate models with global facade auto-wiring ⭐ INTEGRATION

**Description:** As a developer, I want the global facade to auto-wire repositories from built-in models so I don't need to manually create repository bundles.

**Acceptance Criteria:**
- [ ] Extend `Solidus.configure()` to accept `models` option (result from `initializeSolidusModels`)
- [ ] Create repository adapters that wrap the built-in models
  - Each model gets a repository class (e.g., `SolidusCustomerRepository`)
  - Repository implements the repository interface from `contracts.ts`
  - Repository delegates to model static methods
- [ ] Auto-wire all repositories when `models` option is provided
- [ ] Maintain backward compatibility: existing code without `models` option still works
- [ ] Export repository adapter classes for advanced use cases

**Usage Example:**
```ts
import { Solidus, initializeSolidusModels } from '@diegoquiroz/solidus';
import { createSolidusFacade } from '@diegoquiroz/solidus';
import { Sequelize } from 'sequelize';
import Stripe from 'stripe';

const sequelize = new Sequelize(/* ... */);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Initialize models
const models = initializeSolidusModels(sequelize);

// Configure global facade with auto-wiring
Solidus.configure({
  createFacade: createSolidusFacade,
  stripe,
  models, // ← Auto-wires all repositories!
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});

// Use anywhere in your app
const facade = Solidus.getFacade();
```

**Key Integration Points:**
- Modify `GlobalSolidusConfig` interface in `src/packages/core/global-facade.ts`
- Create repository adapters in `src/packages/sequelize/repositories/` directory
- Ensure adapters implement `CustomerRepository`, `PaymentMethodRepository`, etc.

### US-004: Update mixins to work with zero-config pattern ⭐ ERGONOMICS

**Description:** The mixins already exist (`createBillingMixin`, `solidusBillingMixin`), but need to be updated to work seamlessly with the new zero-config pattern using global facade.

**Current State (Already Implemented):**
- `createBillingMixin` and `solidusBillingMixin` exist in `src/packages/core/model-extension.ts`
- They work with explicit facade passing: `createBillingMixin({ ownerType, getOwnerId, facade })`
- They don't add Sequelize associations to the owner model

**Acceptance Criteria:**
- [ ] Create `solidusBilling()` decorator/mixin for Sequelize models that:
  - Adds Sequelize associations (hasMany, belongsTo) to the owner model
  - Adds `billing` getter that returns `BillingOperations`
  - Uses global facade by default (no need to pass facade explicitly)
- [ ] Keep existing `createBillingMixin` for backward compatibility
- [ ] New mixin should work with zero-config setup
- [ ] Add class-level methods: `findWithBilling()`, `billingScope()`

**Usage Example (Zero-Config Pattern):**
```ts
import { Model, DataTypes } from 'sequelize';
import { solidusBilling } from '@diegoquiroz/solidus';
import { Solidus } from '@diegoquiroz/solidus';

class Workspace extends Model {
  declare id: string;
  declare name: string;
  // billing property is added by mixin
  declare billing: BillingOperations;
}

// Initialize Solidus (zero-config)
Solidus.configure({
  createFacade,
  stripe,
  models: initializeSolidusModels(sequelize),
});

// Add billing capabilities to model
solidusBilling(Workspace, { 
  ownerType: 'Workspace',
  getOwnerId: (workspace) => workspace.id,
});

// Use ergonomically
const workspace = await Workspace.findByPk(id);
await workspace.billing.charge({ amount: 1000, currency: 'usd' });
await workspace.billing.subscribe({ priceId: 'price_monthly' });

// Class-level methods
const workspacesWithBilling = await Workspace.findWithBilling();
```

**Files to Modify:**
- `src/packages/core/model-extension.ts` - Add new `solidusBilling()` function
- Keep existing `createBillingMixin` and `solidusBillingMixin` for compatibility

### US-005: Create migration generator/helpers ⭐ SETUP COMPLETION

**Description:** As a developer, I want easy database migration setup without copying SQL files manually.

**Acceptance Criteria:**
- [ ] Create `createSolidusMigrations()` function that returns migration definitions
- [ ] Support Sequelize CLI migration format (up/down functions)
- [ ] Support Umzug migration format
- [ ] Include all tables: customers, charges, subscriptions, payment_methods, invoices, webhook_events, webhook_outbox, idempotency_keys, stripe_customers
- [ ] Include proper indexes for performance:
  - `(owner_type, owner_id)` on customers
  - `(processor, processor_id)` on all processor-linked tables
  - `(event_id, processor)` on webhook_events
  - `(run_at, processed_at)` on webhook_outbox
- [ ] Include foreign key constraints where appropriate
- [ ] Generate TypeScript-friendly migration code (not just SQL)
- [ ] Usage example:
  ```ts
  // In your migration file (e.g., migrations/001-solidus-setup.ts)
  import { createSolidusMigrations } from '@diegoquiroz/solidus';
  
  const migrations = createSolidusMigrations();
  
  export const up = migrations.up;
  export const down = migrations.down;
  ```

**Alternative: One-Line Setup Function**
```ts
// Even simpler - single function that does everything
import { setupSolidus } from '@diegoquiroz/solidus';

const solidus = await setupSolidus({
  sequelize,
  stripe,
  runMigrations: true, // Auto-runs migrations
});

// Returns configured facade with models and repositories
await solidus.models.Customer.create({...});
await solidus.facade.api.charges.charge({...});
```

### US-006: Update documentation for zero-config approach ⭐ DOCUMENTATION

**Description:** As a developer, I want clear documentation showing the new simplified setup.

**Acceptance Criteria:**
- [ ] Update `docs/1_installation.md` with new two-step setup:
  ```ts
  import { setupSolidus } from '@diegoquiroz/solidus';
  
  const solidus = await setupSolidus({
    sequelize,
    stripe,
    runMigrations: true,
  });
  ```
- [ ] Update `docs/getting-started.md` with complete zero-config example
- [ ] Update `docs/llms/express-sequelize-typescript.md` with simplified setup
- [ ] Create `docs/migration-to-zero-config.md` guide for existing users
- [ ] Add before/after comparison table:
  | Step | Old Approach | Zero-Config |
  |------|--------------|-------------|
  | 1 | Create 9 models | Install package |
  | 2 | Copy SQL templates | Call `setupSolidus()` |
  | 3 | Create wrapper migration | Done! |
  | 4 | Wire repository bundle | |
  | 5 | Create facade | |
  | 6 | Configure webhooks | |
  | 7 | Set up mixins | |
  | 8 | Test integration | |
- [ ] Mark old repository pattern docs as "legacy" with deprecation notice
- [ ] Update README.md quickstart example
- [ ] Add troubleshooting section for common migration issues

### US-007: Ensure backward compatibility and migration path ⭐ COMPATIBILITY

**Description:** As an existing Solidus user, I want a clear path to migrate from the old repository pattern without breaking my app.

**Acceptance Criteria:**
- [ ] Keep all existing exports and APIs working (`createSequelizeRepositoryBundleFromModels`, etc.)
- [ ] New zero-config pattern is additive, not replacing
- [ ] Create comprehensive migration guide:
  - Document schema differences (table prefixes, column changes)
  - Provide data migration scripts
  - Show how to run old and new patterns side-by-side during transition
- [ ] Create deprecation timeline:
  - v1.x: Both patterns supported, zero-config recommended
  - v2.x: Old pattern deprecated with warnings
  - v3.x: Old pattern removed (future major version)
- [ ] Test that existing tests still pass without changes
- [ ] Add `migrateToZeroConfig()` helper function that:
  - Detects existing tables
  - Creates new tables with `solidus_` prefix
  - Migrates data
  - Provides rollback capability

**Migration Path for Existing Users:**
```ts
// Phase 1: Keep existing code working
const repositoryBundle = createSequelizeRepositoryBundleFromModels({
  customers: BillingCustomer, // Your existing models
  // ... etc
});

// Phase 2: Gradually migrate to zero-config
const solidus = await setupSolidus({
  sequelize,
  stripe,
  migrateFromLegacy: true, // Migrates your existing data
});

// Phase 3: Remove old models and repository wiring
// Just use solidus.models.* directly

### US-008: Add comprehensive tests for zero-config integration ⭐ QUALITY

**Description:** As a maintainer, I want full test coverage for the zero-config pattern to ensure it works end-to-end.

**Acceptance Criteria:**
- [ ] Create `src/packages/sequelize/models/__tests__/models.test.ts`:
  - [ ] Test all model classes initialize with Sequelize
  - [ ] Test model associations (hasMany, belongsTo) work correctly
  - [ ] Test CRUD operations through model classes
  - [ ] Test model static methods implement repository interfaces
- [ ] Create `src/packages/sequelize/__tests__/zero-config.test.ts`:
  - [ ] Test `initializeSolidusModels` initializes all models
  - [ ] Test `setupSolidus` one-line setup works
  - [ ] Test auto-wiring creates correct repository instances
  - [ ] Test global facade integration works
  - [ ] Test mixins work with zero-config pattern
- [ ] Create `src/packages/core/__tests__/integration-zero-config.test.ts`:
  - [ ] End-to-end test: setup → charge → webhook → sync
  - [ ] Test full billing workflow with zero-config setup
  - [ ] Test backward compatibility (old pattern still works)
- [ ] Update existing tests to ensure they still pass
- [ ] All tests pass with `bun test` (quality gate)

**Test Coverage Requirements:**
- Model initialization: 100%
- Repository adapter methods: 100%
- Zero-config setup path: 100%
- Integration workflow: Core paths covered
- Backward compatibility: Existing tests pass

## Functional Requirements

### FR-1: Model Naming Convention
- All Solidus models use `solidus_` table prefix (e.g., `solidus_customers`)
- Model classes exported as `SolidusCustomer`, `SolidusCharge`, etc.
- User's existing tables are not affected (no conflicts)

### FR-2: Sequelize Compatibility
- Support Sequelize v6.x and v7.x
- Work with both JavaScript and Type Sequelize projects
- Support all major databases (PostgreSQL, MySQL, SQLite)

### FR-3: Repository Interface Compliance
- Models must implement all methods in repository interfaces:
  - `CustomerRepository`: save, findByOwner, findByProcessor
  - `PaymentMethodRepository`: upsert, clearDefaultForCustomer, deleteByProcessorId, findByProcessorId, listByCustomer
  - `ChargeRepository`: upsert, findByProcessorId
  - `SubscriptionRepository`: upsert, findByProcessorId, listByCustomer
  - `WebhookEventRepository`: persist, findByEventId, markProcessed, markRetrying, markDeadLetter
  - `DbOutboxRepository`: enqueue, claimReady, acknowledge
  - `IdempotencyRepository`: checkAndReserve, markProcessed

### FR-4: Auto-Association Setup
- Models automatically set up associations when initialized:
  - Customer hasMany Charges
  - Customer hasMany Subscriptions
  - Customer hasMany PaymentMethods
  - Charge belongsTo Customer
  - Subscription belongsTo Customer
  - PaymentMethod belongsTo Customer

### FR-5: Facade Integration
- `createSolidusBilling` returns object with:
  - `api`: Same as current facade.api (charges, subscriptions, customers, etc.)
  - `webhooks`: Same as current facade.webhooks
  - `models`: Initialized Sequelize model classes
  - `repositories`: Auto-wired repository instances

### FR-6: Mixin API Design
The `solidusBilling()` mixin should provide:

**Instance Methods:**
- `setPaymentProcessor(processor: 'stripe', options?)` - Link to processor
- `charge(options)` - Create charge
- `subscribe(options)` - Create subscription
- `addPaymentMethod(paymentMethodId, options?)` - Add payment method
- `updateDefaultPaymentMethod(paymentMethodId)` - Set default
- `syncBilling()` - Sync from Stripe

**Class Methods:**
- `findWithBilling(options)` - Find with billing relations
- `billingScope()` - Sequelize scope for billing queries

### FR-7: Migration Safety
- Migrations use transactions where supported
- Include indexes on frequently queried columns:
  - `owner_type`, `owner_id`
  - `processor`, `processor_id`
  - `status` columns
  - `created_at`, `updated_at`
- Include unique constraints:
  - `(owner_type, owner_id, processor)` on customers
  - `(processor, processor_id)` on charges, subscriptions, payment_methods

## Non-Goals (Out of Scope)

- **CLI Generator:** Creating a CLI tool (like `rails generate pay:install`) is out of scope for v1. Use programmatic API instead.
- **Auto-Migrations:** Automatically running migrations on startup (Rails does this, but we'll require explicit migration running).
- **Multi-Processor Support:** While schema should allow it, Stripe-only implementation for now (matches current scope).
- **Model Customization Hooks:** Allowing users to extend Solidus models (can be added later).
- **Legacy Pattern Removal:** Don't delete old code yet, just deprecate and provide migration path.

## Technical Considerations

### Sequelize Model Definition Pattern
```typescript
// Example pattern for SolidusCustomer
import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusCustomer extends Model {
  declare id: string;
  declare ownerType: string;
  declare ownerId: string;
  declare processor: string;
  declare processorId: string;
  declare email?: string;
  declare metadata?: object;
  
  // Repository interface methods
  static async save(customer: CustomerRecord): Promise<void> {
    await this.upsert(customer);
  }
  
  static async findByOwner(input: { ownerType: string; ownerId: string }): Promise<CustomerRecord | null> {
    const row = await this.findOne({ where: input });
    return row ? row.toJSON() : null;
  }
  
  // ... other methods
}

export function initSolidusCustomer(sequelize: Sequelize) {
  SolidusCustomer.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    ownerType: { type: DataTypes.STRING, allowNull: false, field: 'owner_type' },
    ownerId: { type: DataTypes.STRING, allowNull: false, field: 'owner_id' },
    processor: { type: DataTypes.STRING, allowNull: false },
    processorId: { type: DataTypes.STRING, allowNull: false, field: 'processor_id' },
    email: DataTypes.STRING,
    metadata: DataTypes.JSONB,
  }, {
    sequelize,
    tableName: 'solidus_customers',
    timestamps: true,
    underscored: true,
  });
}
```

### Association Setup Pattern
```typescript
// In initializeSolidusModels function
export function initializeSolidusModels(sequelize: Sequelize) {
  // Initialize all models
  initSolidusCustomer(sequelize);
  initSolidusCharge(sequelize);
  initSolidusSubscription(sequelize);
  initSolidusPaymentMethod(sequelize);
  // ... etc
  
  // Set up associations
  SolidusCustomer.hasMany(SolidusCharge, { foreignKey: 'customer_id' });
  SolidusCharge.belongsTo(SolidusCustomer, { foreignKey: 'customer_id' });
  
  SolidusCustomer.hasMany(SolidusSubscription, { foreignKey: 'customer_id' });
  SolidusSubscription.belongsTo(SolidusCustomer, { foreignKey: 'customer_id' });
  
  // ... etc
  
  return {
    Customer: SolidusCustomer,
    Charge: SolidusCharge,
    Subscription: SolidusSubscription,
    // ... etc
  };
}
```

### Repository Auto-Wiring Pattern
```typescript
// Repository adapter classes that wrap models
class SolidusCustomerRepository implements CustomerRepository {
  constructor(private model: typeof SolidusCustomer) {}
  
  async save(customer: CustomerRecord): Promise<void> {
    await this.model.upsert(customer);
  }
  
  async findByOwner(input: { ownerType: string; ownerId: string }): Promise<CustomerRecord | null> {
    const row = await this.model.findOne({ where: input });
    return row ? row.toJSON() : null;
  }
  
  // ... etc
}

// In createSolidusBilling
export function createSolidusBilling(options: {
  sequelize: Sequelize;
  stripe: Stripe;
  webhookSecret: string;
  // ... other options
}) {
  const models = initializeSolidusModels(options.sequelize);
  
  const repositories = {
    customers: new SolidusCustomerRepository(models.Customer),
    charges: new SolidusChargeRepository(models.Charge),
    subscriptions: new SolidusSubscriptionRepository(models.Subscription),
    // ... etc
  };
  
  const facade = createSolidusFacade({
    stripe: options.stripe,
    repositories,
    // ... etc
  });
  
  return {
    api: facade.api,
    webhooks: facade.webhooks,
    models,
    repositories,
  };
}
```

## Success Metrics

- [ ] Setup steps reduced from 8 to 2
- [ ] New user can complete setup in <10 minutes (vs current ~30+ minutes)
- [ ] All existing tests pass
- [ ] New model tests achieve >90% coverage
- [ ] Documentation updated with clear before/after comparison
- [ ] At least one example app updated to use new approach

## Migration Path from Old Pattern

### Phase 1: Dual Support (Current)
- Keep existing `createSequelizeRepositoryBundleFromModels`
- Add new `createSolidusBilling` alongside
- Both patterns work

### Phase 2: Deprecation Warning (Future)
- Add deprecation notice to `createSequelizeRepositoryBundleFromModels`
- Guide users to new pattern
- Provide migration script

### Phase 3: Removal (Future Major Version)
- Remove old pattern
- Keep only zero-config approach

## Open Questions

1. **Table Prefix:** Should we use `solidus_` prefix or allow customization? Pay uses `pay_`.
2. **Model Extension:** Should users be able to extend Solidus models? If so, how?
3. **Migration Conflicts:** What if user already has tables named `solidus_customers`?
4. **Sequelize Version:** Should we support both v6 and v7, or just v7?
5. **Database Types:** Should we provide different column types for different databases (JSONB vs JSON)?
6. **Backward Compatibility:** Should we keep old exports indefinitely or plan removal?

## Summary: What's Already Done vs What To Build

### ✅ Already Implemented (Do NOT rebuild)

**Location: `src/packages/core/`**

1. **Global Facade System** (`global-facade.ts`)
   - `Solidus.configure()` - One-time configuration
   - `Solidus.getFacade()` - Global accessor
   - `isConfigured()`, `reset()` - Lifecycle management
   - Works with existing `createSolidusFacade`

2. **Model Mixins** (`model-extension.ts`)
   - `createBillingMixin<TOwner>()` - Create billing operations for any owner
   - `solidusBillingMixin<TOwner>()` - Alias for above
   - `BillingOperations` interface with methods:
     - `setProcessor(customerId?)`
     - `charge({ amount, currency, ... })`
     - `subscribe({ priceId, ... })`
     - `syncCustomer()`
     - `syncSubscriptions(limit?)`
     - `getCustomerId()`
   - Falls back to global facade automatically

3. **Repository Pattern** (`src/packages/sequelize/repositories.ts`)
   - `createSequelizeRepositoryBundleFromModels()` - Manual wiring
   - `SequelizeCustomerRepository`, etc. - Adapter classes
   - Works with user-provided models

### ❌ What Needs To Be Built

**Priority Order:**

1. **US-001**: Built-in Sequelize model definitions (`src/packages/sequelize/models/`)
   - Users currently must create these manually
   - Need to provide: `SolidusCustomer`, `SolidusCharge`, etc.
   - **Estimated effort: Medium** (1-2 days)

2. **US-002**: Model initialization function
   - `initializeSolidusModels(sequelize)` - Register all models
   - Set up associations automatically
   - **Estimated effort: Small** (few hours)

3. **US-003**: Global facade integration
   - Extend `Solidus.configure()` to accept `models` option
   - Auto-wire repository adapters from built-in models
   - **Estimated effort: Medium** (1 day)

4. **US-004**: Enhanced Sequelize mixin
   - `solidusBilling()` - Adds associations + billing getter
   - Works with zero-config pattern
   - **Estimated effort: Small** (few hours)

5. **US-005**: Migration helpers
   - `createSolidusMigrations()` - Programmatic migrations
   - `setupSolidus()` - One-line setup function
   - **Estimated effort: Medium** (1 day)

6. **US-008**: Comprehensive tests
   - Test models, initialization, integration
   - Ensure backward compatibility
   - **Estimated effort: Medium** (1-2 days)

7. **US-006**: Documentation updates
   - Update all docs with zero-config examples
   - Migration guide for existing users
   - **Estimated effort: Small** (few hours)

8. **US-007**: Backward compatibility & migration
   - Keep existing APIs working
   - Migration guide and helpers
   - **Estimated effort: Small** (few hours)

**Total Estimated Effort: 5-7 days of focused work**

## Implementation Order Recommendation

**Phase 1: Foundation (Days 1-2)**
1. **US-001** (Built-in models) - Foundation
2. **US-002** (Initialization function) - Core API
3. **US-008** (Model tests) - Ensure stability

**Phase 2: Integration (Days 3-4)**
4. **US-003** (Global facade integration) - Main user-facing API
5. **US-004** (Enhanced mixin) - Ergonomics layer
6. **US-008** (Integration tests) - Verify everything works

**Phase 3: Polish (Days 5-7)**
7. **US-005** (Migrations) - Setup completion
8. **US-006** (Documentation) - User guidance
9. **US-007** (Migration guide) - Path for existing users
10. **US-008** (Final tests) - Quality gate verification

## Files to Create/Modify

### New Files:
- `src/packages/sequelize/models/SolidusCustomer.ts`
- `src/packages/sequelize/models/SolidusCharge.ts`
- `src/packages/sequelize/models/SolidusSubscription.ts`
- `src/packages/sequelize/models/SolidusPaymentMethod.ts`
- `src/packages/sequelize/models/SolidusInvoice.ts`
- `src/packages/sequelize/models/SolidusWebhookEvent.ts`
- `src/packages/sequelize/models/SolidusWebhookOutbox.ts`
- `src/packages/sequelize/models/SolidusIdempotencyKey.ts`
- `src/packages/sequelize/models/SolidusStripeCustomer.ts`
- `src/packages/sequelize/models/index.ts`
- `src/packages/sequelize/models/__tests__/models.test.ts`
- `src/packages/sequelize/billing.ts` (createSolidusBilling)
- `src/packages/sequelize/mixin.ts` (solidusBilling)
- `src/packages/sequelize/migrations.ts` (createSolidusMigrations)

### Modified Files:
- `src/packages/sequelize/index.ts` - Add new exports
- `src/packages/sequelize/repositories.ts` - Keep for backward compat
- `docs/1_installation.md` - Update setup instructions
- `docs/getting-started.md` - Update quickstart
- `docs/llms/express-sequelize-typescript.md` - Update LLM guide
- `README.md` - Update main README

## Key Files Already Implemented

**Global Facade & Mixins:**
- `src/packages/core/global-facade.ts` - ✅ Global configuration system
- `src/packages/core/model-extension.ts` - ✅ Billing mixins (`createBillingMixin`, `solidusBillingMixin`)

**Repository Pattern:**
- `src/packages/sequelize/repositories.ts` - ✅ Repository adapters and manual wiring

**Schema & Migrations:**
- `packages/sequelize/migrations/templates/` - ✅ SQL migration templates (for manual copying)
- `packages/sequelize/src/schema.ts` - ✅ Schema specification

**Tests:**
- `src/packages/core/__tests__/global-facade.test.ts` - ✅ Global facade tests
- `src/packages/core/__tests__/model-extension.test.ts` - ✅ Mixin tests (implied by imports)

## Quick Start for Implementer

**Step 1:** Read existing implementations
```bash
# Global facade and mixins (already done)
cat src/packages/core/global-facade.ts
cat src/packages/core/model-extension.ts

# Current repository pattern (to extend)
cat src/packages/sequelize/repositories.ts

# Schema specification
cat packages/sequelize/src/schema.ts
```

**Step 2:** Understand the gap
- Current: Users must create models + wire repositories manually
- Target: `setupSolidus({ sequelize, stripe })` → everything works

**Step 3:** Start with US-001 (built-in models)
- Create `src/packages/sequelize/models/` directory
- Implement model classes following schema spec
- Use existing repository tests as interface contract

## Files You Should Read First

As the implementer, start by understanding these existing implementations:

```bash
# 1. Understand the mixin system (already built)
cat src/packages/core/model-extension.ts

# 2. Understand the global facade (already built)
cat src/packages/core/global-facade.ts

# 3. Understand the repository pattern (to extend)
cat src/packages/sequelize/repositories.ts

# 4. Understand the schema requirements
cat packages/sequelize/src/schema.ts

# 5. Look at existing tests to understand expected behavior
cat src/packages/core/__tests__/global-facade.test.ts
```

## Key Insight: Don't Rebuild Mixins/Facade

The user mentioned that mixins already exist. After investigation, I confirmed:
- ✅ `createBillingMixin` and `solidusBillingMixin` exist and work
- ✅ `Solidus.configure()` and `getGlobalFacade()` exist and work
- ✅ Repository adapters exist in `repositories.ts`

**Your job is NOT to rebuild these** - your job is to:
1. Create the built-in Sequelize model classes that are missing
2. Wire them into the existing global facade system
3. Make the setup seamless (one-line `setupSolidus()` function)

## Acceptance Criteria for PRD Completion

- [x] All user stories defined with clear acceptance criteria
- [x] Quality gates specified (bun test)
- [x] Technical approach documented
- [x] Migration path outlined
- [x] Open questions identified
- [x] Implementation order recommended
- [x] Files to create/modify listed
- [x] **Existing implementations identified and referenced**
- [x] **Clear gap analysis (what's done vs what to build)**

---

**Status:** ✅ Ready for implementation  
**Prerequisites:** ✅ Already implemented - global facade and mixins exist  
**Next Step:** Execute user stories in order, starting with US-001 (built-in Sequelize models)  
**Estimated Effort:** 5-7 days of focused work
