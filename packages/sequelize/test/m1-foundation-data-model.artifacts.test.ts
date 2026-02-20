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
      "invoices",
      "merchants",
      "payment_methods",
      "subscriptions",
      "webhook_outbox",
      "webhooks"
    ]);
  });

  test("documents required uniqueness semantics", () => {
    const customers = m1FoundationSchema.tables.customers!;
    const invoices = m1FoundationSchema.tables.invoices!;
    const paymentMethods = m1FoundationSchema.tables.payment_methods!;
    const outbox = m1FoundationSchema.tables.webhook_outbox!;
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
    expect(invoices.indexes).toContain(
      "UNIQUE (processor, processor_id)"
    );
    expect(webhooks.indexes).toContain(
      "UNIQUE (processor, event_id)"
    );
    expect(outbox.indexes).toContain(
      "UNIQUE (job_idempotency_key) WHERE job_idempotency_key IS NOT NULL"
    );
  });

  test("includes webhook lifecycle and invoice projection columns", () => {
    const subscriptions = m1FoundationSchema.tables.subscriptions!;
    const charges = m1FoundationSchema.tables.charges!;
    const paymentMethods = m1FoundationSchema.tables.payment_methods!;
    const invoices = m1FoundationSchema.tables.invoices!;
    const webhooks = m1FoundationSchema.tables.webhooks!;

    expect(subscriptions.columns).toHaveProperty("price_id");
    expect(subscriptions.columns).toHaveProperty("cancel_at_period_end");
    expect(subscriptions.columns).toHaveProperty("raw_payload");
    expect(charges.columns).toHaveProperty("receipt_url");
    expect(charges.columns).toHaveProperty("payment_method_snapshot");
    expect(charges.columns).toHaveProperty("raw_payload");
    expect(paymentMethods.columns).toHaveProperty("exp_month");
    expect(paymentMethods.columns).toHaveProperty("exp_year");
    expect(paymentMethods.columns).toHaveProperty("raw_payload");
    expect(invoices.columns).toHaveProperty("customer_processor_id");
    expect(invoices.columns).toHaveProperty("subscription_processor_id");
    expect(invoices.columns).toHaveProperty("raw_payload");
    expect(webhooks.columns).toHaveProperty("attempt_count");
    expect(webhooks.columns).toHaveProperty("next_attempt_at");
    expect(webhooks.columns).toHaveProperty("dead_lettered_at");
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
      "invoices",
      "payment_methods",
      "webhook_outbox",
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
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_invoices_processor_processor_id\s+ON invoices \(processor, processor_id\);/
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX ux_webhook_outbox_job_idempotency_key\s+ON webhook_outbox \(job_idempotency_key\)\s+WHERE job_idempotency_key IS NOT NULL;/
    );
  });

  test("up migration includes webhook lifecycle and projection columns", async () => {
    const sql = await readProjectFile(upMigrationPath);

    expect(sql).toContain("attempt_count INTEGER NOT NULL DEFAULT 0");
    expect(sql).toContain("next_attempt_at TIMESTAMPTZ");
    expect(sql).toContain("dead_lettered_at TIMESTAMPTZ");
    expect(sql).toContain("customer_processor_id TEXT NOT NULL");
    expect(sql).toContain("raw_payload JSONB NOT NULL");
    expect(sql).toContain("CREATE TABLE invoices (");
    expect(sql).toContain("subscription_processor_id TEXT");
    expect(sql).toContain("CREATE TABLE webhook_outbox (");
    expect(sql).toContain("job_payload JSONB NOT NULL");
  });

  test("down migration drops tables and indexes", async () => {
    const sql = await readProjectFile(downMigrationPath);

    expect(sql).toContain("DROP TABLE IF EXISTS webhooks;");
    expect(sql).toContain("DROP TABLE IF EXISTS webhook_outbox;");
    expect(sql).toContain("DROP TABLE IF EXISTS invoices;");
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
