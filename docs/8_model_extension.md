# Pay-Style Model Ergonomics (Optional)

Solidus supports Pay gem-style ergonomics where billing methods are available directly on your models (e.g., `user.payCustomer().charge()`) instead of requiring facade calls.

## Overview

This is an optional feature that adds convenience methods to your ORM models. It requires global facade configuration and works best with Sequelize or similar ORMs.

## When to Use

- You want Pay gem-style ergonomics (`user.billing.charge()`)
- Your app uses a single global Solidus configuration
- You prefer method chaining on model instances

## When Not to Use

- You need per-instance dependency injection flexibility
- You want to avoid global state
- You're using plain objects without a class-based ORM

## Setup

### 1. Configure Global Facade

First, configure the global facade once at app startup:

```typescript
import { Solidus, createSolidusFacade } from "solidus";
import Stripe from "stripe";

// Configure once
Solidus.configure({
  createFacade: createSolidusFacade,
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY!),
  repositories: {
    customers: customerRepository,
    paymentMethods: paymentMethodRepository,
    charges: chargeRepository,
    subscriptions: subscriptionRepository,
  },
  ownerCustomers: ownerCustomerRepository,
});
```

### 2. Add Billing Mixin to Models

Add the billing mixin to your Sequelize (or similar) models:

```typescript
import { solidusBillingMixin } from "solidus";
import { Model, DataTypes } from "sequelize";

class Workspace extends Model {
  declare id: string;
  declare name: string;
  
  // Add billing getter using the mixin
  get billing() {
    return solidusBillingMixin({
      ownerType: "Workspace",
      getOwnerId: (instance) => instance.id,
    })(this);
  }
}

// Or define it as a static property
class User extends Model {
  declare id: string;
  declare email: string;
  
  static billing = solidusBillingMixin({
    ownerType: "User",
    getOwnerId: (instance) => instance.id,
  });
}

// Usage with static property
const user = await User.findByPk(userId);
await User.billing(user).charge({ amount: 1000, currency: "usd" });
```

## Usage Examples

### Set Up Stripe Customer

```typescript
const workspace = await Workspace.findByPk(workspaceId);

// Set up Stripe processor for this workspace
const result = await workspace.billing.setProcessor();
console.log(`Stripe customer created: ${result.customerId}`);
```

### Create a Charge

```typescript
const workspace = await Workspace.findByPk(workspaceId);

// Charge the workspace's default payment method
const charge = await workspace.billing.charge({
  amount: 5000, // $50.00 in cents
  currency: "usd",
  description: "Premium plan monthly fee",
});

console.log(`Charge created: ${charge.processorId}`);
```

### Create a Subscription

```typescript
const workspace = await Workspace.findByPk(workspaceId);

// Create subscription (auto-creates customer if needed)
const subscription = await workspace.billing.subscribe({
  priceId: "price_monthly_premium",
  quantity: 1,
});

console.log(`Subscription status: ${subscription.status}`);
```

### Sync Customer Data

```typescript
const workspace = await Workspace.findByPk(workspaceId);

// Sync local projection with Stripe
const customer = await workspace.billing.syncCustomer();
if (customer) {
  console.log(`Customer email: ${customer.email}`);
}
```

### Sync Subscriptions

```typescript
const workspace = await Workspace.findByPk(workspaceId);

// Get all subscriptions from Stripe and sync local projections
const subscriptions = await workspace.billing.syncSubscriptions();
for (const sub of subscriptions) {
  console.log(`Subscription: ${sub.id} - ${sub.status}`);
}
```

### Check Customer ID

```typescript
const workspace = await Workspace.findByPk(workspaceId);

// Get the Stripe customer ID without syncing
const customerId = await workspace.billing.getCustomerId();
if (customerId) {
  console.log(`Has Stripe customer: ${customerId}`);
}
```

## Per-Instance Facade (Alternative)

If you can't use global configuration, pass the facade instance directly:

```typescript
import { solidusBillingMixin } from "solidus";

class Workspace extends Model {
  // Use a factory or DI to get the facade
  get billing() {
    return solidusBillingMixin({
      ownerType: "Workspace",
      getOwnerId: (instance) => instance.id,
      facade: app.solidusFacade, // Your app's facade instance
    })(this);
  }
}
```

## Error Handling

The mixin throws `SolidusNotConfiguredError` if you try to use billing methods without configuring the global facade:

```typescript
import { SolidusNotConfiguredError } from "solidus";

try {
  await workspace.billing.charge({ amount: 1000, currency: "usd" });
} catch (error) {
  if (error instanceof SolidusNotConfiguredError) {
    console.error("Solidus not configured. Call Solidus.configure() first.");
  }
}
```

## Type Safety

The mixin is fully typed with TypeScript:

```typescript
import { solidusBillingMixin, BillingOperations } from "solidus";

interface Workspace {
  id: string;
  name: string;
}

const billingMixin = solidusBillingMixin<Workspace>({
  ownerType: "Workspace",
  getOwnerId: (instance) => instance.id,
});

// TypeScript knows the billing operations available
const billing: BillingOperations = billingMixin(workspace);
```

## Complete Example with Sequelize

```typescript
// models/workspace.ts
import { Model, DataTypes } from "sequelize";
import { solidusBillingMixin } from "solidus";

export class Workspace extends Model {
  declare id: string;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  
  get billing() {
    return solidusBillingMixin({
      ownerType: "Workspace",
      getOwnerId: (instance: Workspace) => instance.id,
    })(this);
  }
}

// models/index.ts
export function initModels(sequelize: Sequelize) {
  Workspace.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "workspaces",
    }
  );
}

// app.ts
import { Solidus, createSolidusFacade } from "solidus";
import Stripe from "stripe";

Solidus.configure({
  createFacade: createSolidusFacade,
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY!),
  repositories: {
    // ... your repositories
  },
  ownerCustomers: ownerCustomerRepository,
});

// routes/charges.ts
import { Router } from "express";
import { Workspace } from "../models/workspace";

const router = Router();

router.post("/workspaces/:id/charge", async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) {
    return res.status(404).json({ error: "Workspace not found" });
  }
  
  const { amount, currency } = req.body;
  
  try {
    const charge = await workspace.billing.charge({
      amount,
      currency,
    });
    
    res.json({
      success: true,
      chargeId: charge.processorId,
      status: charge.status,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
```

## Comparison: Facade vs Model Ergonomics

### Facade Style (Explicit DI)

```typescript
// Requires passing facade around or accessing from context
const facade = req.app.get("solidusFacade");

await facade.convenience.setOwnerStripeProcessor({
  ownerType: "Workspace",
  ownerId: workspace.id,
});

await facade.api.charges.charge({
  customerId: customerId,
  amount: 1000,
  currency: "usd",
});
```

### Model Ergonomics Style

```typescript
// Clean, chainable methods on the model itself
await workspace.billing.setProcessor();
await workspace.billing.charge({ amount: 1000, currency: "usd" });
```

Choose the style that fits your application's architecture and preferences.
