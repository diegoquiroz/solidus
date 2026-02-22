# Migration Guide: From Manual Setup to Zero-Config

## Overview

This guide helps you migrate from the legacy manual repository pattern to the new zero-config pattern.

## When to Migrate

Migrate if you:
- Created your own Sequelize models manually
- Used `createSequelizeRepositoryBundleFromModels()`
- Want to simplify your setup

## Migration Steps

### Step 1: Backup Your Database
Always backup before migration.

### Step 2: Install Latest Version
\`\`\`bash
bun add @diegoquiroz/solidus@latest
\`\`\`

### Step 3: Run Migration Helper

Create a script (e.g., `scripts/migrate-solidus.ts`) to run the migration:

\`\`\`typescript
import { Sequelize } from "sequelize";
import { migrateToZeroConfig } from "@diegoquiroz/solidus/sequelize";

// Initialize your Sequelize instance
const sequelize = new Sequelize("database", "username", "password", {
  dialect: "postgres", // or mysql, sqlite, etc.
  // ... other options
});

async function run() {
  const result = await migrateToZeroConfig({
    sequelize,
    legacyTablePrefix: "billing_", // Your current prefix (default is billing_)
    newTablePrefix: "solidus_", // New prefix (default is solidus_)
    dryRun: true, // Preview first
  });

  console.log("Tables Created:", result.tablesCreated);
  console.log("Tables Migrated:", result.tablesMigrated);
  console.log("Records Migrated:", result.recordsMigrated);
}

run();
\`\`\`

Run it with `bun run scripts/migrate-solidus.ts`.

### Step 4: Apply Migration

Once you are satisfied with the dry run, set `dryRun: false` and run the script again.

\`\`\`typescript
const result = await migrateToZeroConfig({
  sequelize,
  legacyTablePrefix: "billing_",
  newTablePrefix: "solidus_",
  dryRun: false, // Actually migrate
});
\`\`\`

### Step 5: Update Your Code

Replace your old setup with the new zero-config setup using `Solidus.configure` and `initializeSolidusModels`.

**Old Code:**
\`\`\`typescript
import { createSequelizeRepositoryBundleFromModels } from "@diegoquiroz/solidus/sequelize";
// ... extensive model definition and wiring ...
const bundle = createSequelizeRepositoryBundleFromModels(models);
\`\`\`

**New Code:**
\`\`\`typescript
import { Solidus } from "@diegoquiroz/solidus";
import { initializeSolidusModels } from "@diegoquiroz/solidus/sequelize";

// Initialize models
const models = initializeSolidusModels(sequelize);

// Configure Solidus
Solidus.configure({
  models,
  // ... other config
});
\`\`\`

### Step 6: Verify and Remove Old Tables

After confirming everything works and your data is accessible via the new tables, you can drop the old tables.

## Schema Differences

| Legacy (Typical) | New (Solidus) | Notes |
|------------------|---------------|-------|
| `billing_customers` | `solidus_customers` | Table renamed |
| `id: INTEGER` | `id: UUID` | Primary key type changed to UUID |
| `owner_type` | `owner_type` | Preserved |
| `owner_id` | `owner_id` | Preserved |
| `processor` | `processor` | Preserved |

## Rollback Plan

If something goes wrong during the migration:
1. Since the migration creates *new* tables and copies data, your old tables are untouched.
2. Simply revert your code changes to point back to the old tables.
3. Drop the new `solidus_*` tables when ready to try again.
