import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export interface GenerateMigrationOptions {
  outputDir: string;
  migrationName?: string;
  tablePrefix?: string;
  format?: "typescript" | "javascript" | "umzug";
}

export interface GeneratedMigration {
  filename: string;
  filepath: string;
  content: string;
}

function generateTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

function generateMigrationContent(
  format: "typescript" | "javascript" | "umzug",
  tablePrefix: string,
): string {
  const prefix = tablePrefix;

  if (format === "umzug") {
    return `module.exports = {
  async up({ context: { queryInterface, Sequelize } }) {
    const { DataTypes } = Sequelize;
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. ${prefix}customers
      await queryInterface.createTable('${prefix}customers', {
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

      await queryInterface.addIndex('${prefix}customers', ['owner_type', 'owner_id'], { transaction });
      await queryInterface.addIndex('${prefix}customers', ['processor', 'processor_id'], { unique: true, transaction });

      // 2. ${prefix}charges
      await queryInterface.createTable('${prefix}charges', {
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

      await queryInterface.addIndex('${prefix}charges', ['processor', 'processor_id'], { unique: true, transaction });
      await queryInterface.addIndex('${prefix}charges', ['customer_id'], { transaction });
      await queryInterface.addIndex('${prefix}charges', ['customer_processor_id'], { transaction });

      // 3. ${prefix}subscriptions
      await queryInterface.createTable('${prefix}subscriptions', {
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

      await queryInterface.addIndex('${prefix}subscriptions', ['processor', 'processor_id'], { unique: true, transaction });
      await queryInterface.addIndex('${prefix}subscriptions', ['customer_id'], { transaction });
      await queryInterface.addIndex('${prefix}subscriptions', ['customer_processor_id'], { transaction });

      // 4. ${prefix}payment_methods
      await queryInterface.createTable('${prefix}payment_methods', {
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

      await queryInterface.addIndex('${prefix}payment_methods', ['processor', 'processor_id'], { unique: true, transaction });
      await queryInterface.addIndex('${prefix}payment_methods', ['customer_id'], { transaction });
      await queryInterface.addIndex('${prefix}payment_methods', ['customer_processor_id'], { transaction });

      // 5. ${prefix}invoices
      await queryInterface.createTable('${prefix}invoices', {
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

      await queryInterface.addIndex('${prefix}invoices', ['processor', 'processor_id'], { unique: true, transaction });

      // 6. ${prefix}webhook_events
      await queryInterface.createTable('${prefix}webhook_events', {
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

      await queryInterface.addIndex('${prefix}webhook_events', ['event_id', 'processor'], { unique: true, transaction });

      // 7. ${prefix}webhook_outbox
      await queryInterface.createTable('${prefix}webhook_outbox', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        job_name: { type: DataTypes.STRING, allowNull: false },
        job_payload: { type: DataTypes.JSONB, allowNull: false },
        job_idempotency_key: { type: DataTypes.STRING, allowNull: true },
        run_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        processed_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });

      await queryInterface.addIndex('${prefix}webhook_outbox', ['run_at', 'processed_at'], { transaction });
      await queryInterface.addIndex('${prefix}webhook_outbox', ['job_idempotency_key'], { unique: true, transaction });

      // 8. ${prefix}idempotency_keys
      await queryInterface.createTable('${prefix}idempotency_keys', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        key: { type: DataTypes.STRING, allowNull: false },
        scope: { type: DataTypes.STRING, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });

      await queryInterface.addIndex('${prefix}idempotency_keys', ['key', 'scope'], { unique: true, transaction });

      // 9. ${prefix}stripe_customers
      await queryInterface.createTable('${prefix}stripe_customers', {
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

      await queryInterface.addIndex('${prefix}stripe_customers', ['processor', 'processor_id'], { unique: true, transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down({ context: { queryInterface } }) {
    const tables = [
      '${prefix}stripe_customers',
      '${prefix}idempotency_keys',
      '${prefix}webhook_outbox',
      '${prefix}webhook_events',
      '${prefix}invoices',
      '${prefix}payment_methods',
      '${prefix}subscriptions',
      '${prefix}charges',
      '${prefix}customers',
    ];

    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  },
};
`;
  }

  // TypeScript/JavaScript format for Sequelize CLI
  const isTypeScript = format === "typescript";
  const ext = isTypeScript ? "ts" : "js";
  const importStatement = isTypeScript
    ? `import { QueryInterface, DataTypes } from 'sequelize';`
    : `const { DataTypes } = require('sequelize');`;
  const exportStatement = isTypeScript
    ? `export async function up(queryInterface: QueryInterface): Promise<void> {`
    : `async function up(queryInterface) {`;
  const exportDown = isTypeScript
    ? `export async function down(queryInterface: QueryInterface): Promise<void> {`
    : `async function down(queryInterface) {`;
  const moduleExports = isTypeScript
    ? ""
    : `
module.exports = { up, down };`;

  return `${importStatement}

${exportStatement}
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // 1. ${prefix}customers
    await queryInterface.createTable('${prefix}customers', {
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

    await queryInterface.addIndex('${prefix}customers', ['owner_type', 'owner_id'], { transaction });
    await queryInterface.addIndex('${prefix}customers', ['processor', 'processor_id'], { unique: true, transaction });

    // 2. ${prefix}charges
    await queryInterface.createTable('${prefix}charges', {
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

    await queryInterface.addIndex('${prefix}charges', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('${prefix}charges', ['customer_id'], { transaction });
    await queryInterface.addIndex('${prefix}charges', ['customer_processor_id'], { transaction });

    // 3. ${prefix}subscriptions
    await queryInterface.createTable('${prefix}subscriptions', {
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

    await queryInterface.addIndex('${prefix}subscriptions', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('${prefix}subscriptions', ['customer_id'], { transaction });
    await queryInterface.addIndex('${prefix}subscriptions', ['customer_processor_id'], { transaction });

    // 4. ${prefix}payment_methods
    await queryInterface.createTable('${prefix}payment_methods', {
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

    await queryInterface.addIndex('${prefix}payment_methods', ['processor', 'processor_id'], { unique: true, transaction });
    await queryInterface.addIndex('${prefix}payment_methods', ['customer_id'], { transaction });
    await queryInterface.addIndex('${prefix}payment_methods', ['customer_processor_id'], { transaction });

    // 5. ${prefix}invoices
    await queryInterface.createTable('${prefix}invoices', {
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

    await queryInterface.addIndex('${prefix}invoices', ['processor', 'processor_id'], { unique: true, transaction });

    // 6. ${prefix}webhook_events
    await queryInterface.createTable('${prefix}webhook_events', {
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

    await queryInterface.addIndex('${prefix}webhook_events', ['event_id', 'processor'], { unique: true, transaction });

    // 7. ${prefix}webhook_outbox
    await queryInterface.createTable('${prefix}webhook_outbox', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      job_name: { type: DataTypes.STRING, allowNull: false },
      job_payload: { type: DataTypes.JSONB, allowNull: false },
      job_idempotency_key: { type: DataTypes.STRING, allowNull: true },
      run_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('${prefix}webhook_outbox', ['run_at', 'processed_at'], { transaction });
    await queryInterface.addIndex('${prefix}webhook_outbox', ['job_idempotency_key'], { unique: true, transaction });

    // 8. ${prefix}idempotency_keys
    await queryInterface.createTable('${prefix}idempotency_keys', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      key: { type: DataTypes.STRING, allowNull: false },
      scope: { type: DataTypes.STRING, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });

    await queryInterface.addIndex('${prefix}idempotency_keys', ['key', 'scope'], { unique: true, transaction });

    // 9. ${prefix}stripe_customers
    await queryInterface.createTable('${prefix}stripe_customers', {
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

    await queryInterface.addIndex('${prefix}stripe_customers', ['processor', 'processor_id'], { unique: true, transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

${exportDown}
  const tables = [
    '${prefix}stripe_customers',
    '${prefix}idempotency_keys',
    '${prefix}webhook_outbox',
    '${prefix}webhook_events',
    '${prefix}invoices',
    '${prefix}payment_methods',
    '${prefix}subscriptions',
    '${prefix}charges',
    '${prefix}customers',
  ];

  for (const table of tables) {
    await queryInterface.dropTable(table);
  }
}${moduleExports}
`;
}

export function generateSolidusMigration(
  options: GenerateMigrationOptions,
): GeneratedMigration {
  const {
    outputDir,
    migrationName = "create_solidus_tables",
    tablePrefix = "solidus_",
    format = "typescript",
  } = options;

  const timestamp = generateTimestamp();
  const ext = format === "umzug" ? "js" : format === "typescript" ? "ts" : "js";
  const filename = `${timestamp}-${migrationName}.${ext}`;
  const content = generateMigrationContent(format, tablePrefix);

  return {
    filename,
    filepath: join(outputDir, filename),
    content,
  };
}

export function writeSolidusMigration(options: GenerateMigrationOptions): string {
  const { outputDir } = options;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const migration = generateSolidusMigration(options);
  writeFileSync(migration.filepath, migration.content);

  return migration.filepath;
}

export function generateMigration(
  outputDir: string,
  options: Omit<GenerateMigrationOptions, "outputDir"> = {},
): string {
  return writeSolidusMigration({
    outputDir,
    ...options,
  });
}
