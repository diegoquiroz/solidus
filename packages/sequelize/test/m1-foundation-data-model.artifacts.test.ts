import { describe, expect, test } from "bun:test";
import { m1FoundationSchema } from "../src/schema";

const upMigrationPath =
  "packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.up.sql";
const downMigrationPath =
  "packages/sequelize/migrations/templates/202602190001-m1-foundation-data-model.down.sql";

async function readProjectFile(path: string): Promise<string> {
  return Bun.file(new URL(`../../../${path}`, import.meta.url)).text();
}

describe("m1 foundation schema artifacts", () => {
  test("exports required table specs", () => {
    expect(Object.keys(m1FoundationSchema.tables).sort()).toEqual([
      "charges",
      "customers",
      "merchants",
      "payment_methods",
      "subscriptions",
      "webhooks"
    ]);
  });

  test("documents required uniqueness semantics", () => {
    const customers = m1FoundationSchema.tables.customers!;
    const paymentMethods = m1FoundationSchema.tables.payment_methods!;
    const webhooks = m1FoundationSchema.tables.webhooks!;

    expect(customers.indexes).toContain(
      "UNIQUE (processor, processor_id)"
    );
    expect(customers.indexes).toContain(
      "UNIQUE (owner_type, owner_id) WHERE is_default"
    );
    expect(paymentMethods.indexes).toContain(
      "UNIQUE (customer_id) WHERE is_default"
    );
    expect(webhooks.indexes).toContain(
      "UNIQUE (processor, event_id)"
    );
  });
});

describe("m1 SQL migration templates", () => {
  test("up migration creates required tables", async () => {
    const sql = await readProjectFile(upMigrationPath);

    for (const tableName of [
      "merchants",
      "customers",
      "subscriptions",
      "charges",
      "payment_methods",
      "webhooks"
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${tableName} \\(`));
    }
  });

  test("up migration defines required idempotency and default indexes", async () => {
    const sql = await readProjectFile(upMigrationPath);

    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_customers_processor_processor_id\s+ON customers \(processor, processor_id\);/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_payment_methods_processor_processor_id\s+ON payment_methods \(processor, processor_id\);/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_charges_processor_processor_id\s+ON charges \(processor, processor_id\);/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_subscriptions_processor_processor_id\s+ON subscriptions \(processor, processor_id\);/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_merchants_processor_processor_id\s+ON merchants \(processor, processor_id\);/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_customers_default_owner\s+ON customers \(owner_type, owner_id\)\s+WHERE is_default;/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_payment_methods_default_customer\s+ON payment_methods \(customer_id\)\s+WHERE is_default;/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_webhooks_processor_event_id\s+ON webhooks \(processor, event_id\);/
    );
  });

  test("down migration drops tables and indexes", async () => {
    const sql = await readProjectFile(downMigrationPath);

    expect(sql).toContain("DROP TABLE IF EXISTS webhooks;");
    expect(sql).toContain("DROP TABLE IF EXISTS payment_methods;");
    expect(sql).toContain("DROP TABLE IF EXISTS charges;");
    expect(sql).toContain("DROP TABLE IF EXISTS subscriptions;");
    expect(sql).toContain("DROP TABLE IF EXISTS customers;");
    expect(sql).toContain("DROP TABLE IF EXISTS merchants;");
    expect(sql).toContain("DROP INDEX IF EXISTS ux_webhooks_processor_event_id;");
    expect(sql).toContain("DROP INDEX IF EXISTS ux_customers_default_owner;");
    expect(sql).toContain("DROP INDEX IF EXISTS ux_payment_methods_default_customer;");
  });
});
