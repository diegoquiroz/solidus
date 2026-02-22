import { Sequelize, QueryTypes } from "sequelize";
import { randomUUID } from "node:crypto";
import {
  initSolidusCustomer,
  initSolidusCharge,
  initSolidusSubscription,
  initSolidusPaymentMethod,
  initSolidusMerchant,
  initSolidusWebhookEvent,
  initSolidusIdempotencyKey,
} from "./models/index.ts";

export interface MigrateToZeroConfigOptions {
  sequelize: Sequelize;
  legacyTablePrefix?: string; // e.g., 'billing_'
  newTablePrefix?: string; // default: 'solidus_'
  dryRun?: boolean; // default: false
}

export interface MigrateToZeroConfigResult {
  tablesCreated: string[];
  tablesMigrated: string[];
  recordsMigrated: Record<string, number>;
}

const TABLE_MAPPINGS = {
  customers: "customers",
  charges: "charges",
  subscriptions: "subscriptions",
  paymentMethods: "payment_methods",
  merchants: "merchants",
  webhookEvents: "webhooks",
  idempotencyKeys: "idempotency_keys",
} as const;

export async function migrateToZeroConfig(
  options: MigrateToZeroConfigOptions
): Promise<MigrateToZeroConfigResult> {
  const { sequelize } = options;
  const dryRun = options.dryRun ?? false;
  const legacyPrefix = options.legacyTablePrefix ?? "billing_";
  const newPrefix = options.newTablePrefix ?? "solidus_";

  const result: MigrateToZeroConfigResult = {
    tablesCreated: [],
    tablesMigrated: [],
    recordsMigrated: {},
  };

  // 1. Detect existing legacy tables
  // Sequelize showAllTables returns different formats depending on dialect
  const existingTables = await sequelize.getQueryInterface().showAllTables();
  // Normalize table names to strings
  const tableNames = existingTables.map((t: any) => 
    typeof t === 'string' ? t : t.tableName
  );
  
  const legacyTables = tableNames.filter((t) => t.startsWith(legacyPrefix));

  if (legacyTables.length === 0) {
    console.log(`No legacy tables found with prefix '${legacyPrefix}'`);
    return result;
  }

  // 2. Initialize new models (this defines the schema for Sequelize)
  const NewModels = {
    customers: initSolidusCustomer(sequelize, newPrefix),
    charges: initSolidusCharge(sequelize, newPrefix),
    subscriptions: initSolidusSubscription(sequelize, newPrefix),
    paymentMethods: initSolidusPaymentMethod(sequelize, newPrefix),
    merchants: initSolidusMerchant(sequelize, newPrefix),
    webhookEvents: initSolidusWebhookEvent(sequelize, newPrefix),
    idempotencyKeys: initSolidusIdempotencyKey(sequelize, newPrefix),
  };

  // 3. Migrate each table type
  for (const [key, suffix] of Object.entries(TABLE_MAPPINGS)) {
    const legacyTableName = `${legacyPrefix}${suffix}`;
    const newTableName = `${newPrefix}${suffix}`;

    if (!legacyTables.includes(legacyTableName)) {
      continue;
    }

    if (dryRun) {
      console.log(
        `[Dry Run] Would create table '${newTableName}' and migrate data from '${legacyTableName}'`
      );
      result.tablesCreated.push(newTableName);
      result.tablesMigrated.push(legacyTableName);
      // Estimate count?
      try {
        const countResult = await sequelize.query<{ count: string | number }>(
          `SELECT COUNT(*) as count FROM ${legacyTableName}`,
          { type: QueryTypes.SELECT }
        );
        const countVal = countResult[0]?.count;
        result.recordsMigrated[newTableName] = typeof countVal === 'string' ? parseInt(countVal, 10) : (countVal as number) || 0;
      } catch (e) {
        console.warn(`Could not count records for ${legacyTableName}:`, e);
        result.recordsMigrated[newTableName] = 0;
      }
      continue;
    }

    // Identify the correct model
    let model: any;
    switch (key) {
        case "customers": model = NewModels.customers; break;
        case "charges": model = NewModels.charges; break;
        case "subscriptions": model = NewModels.subscriptions; break;
        case "paymentMethods": model = NewModels.paymentMethods; break;
        case "merchants": model = NewModels.merchants; break;
        case "webhookEvents": model = NewModels.webhookEvents; break;
        case "idempotencyKeys": model = NewModels.idempotencyKeys; break;
    }

    if (!model) continue;

    // Create new table if not exists
    await model.sync();
    result.tablesCreated.push(newTableName);

    // Migrate Data
    try {
      // Fetch all from legacy
      const legacyRows = await sequelize.query<Record<string, unknown>>(
        `SELECT * FROM ${legacyTableName}`,
        { type: QueryTypes.SELECT }
      );

      if (legacyRows.length === 0) {
        continue;
      }

      const newRecords = legacyRows.map((row) => {
          const normalizedRow = toCamelCaseKeys(row);
          return {
              ...normalizedRow,
              id: randomUUID(), // New UUID
              createdAt: row.created_at ?? row.createdAt ?? new Date(),
              updatedAt: row.updated_at ?? row.updatedAt ?? new Date(),
          };
      });
      
      await model.bulkCreate(newRecords);
      result.recordsMigrated[newTableName] = newRecords.length;
      result.tablesMigrated.push(legacyTableName);

    } catch (e) {
      console.error(`Failed to migrate records from ${legacyTableName} to ${newTableName}:`, e);
      throw e;
    }
  }

  return result;
}

function toCamelCaseKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(toCamelCaseKeys);
    
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
        // Simple snake_to_camel conversion
        const camelKey = key.replace(/_([a-z])/g, (_match, p1) => p1.toUpperCase());
        newObj[camelKey] = obj[key];
    }
    return newObj;
}
