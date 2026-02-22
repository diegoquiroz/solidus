import type { QueryInterface, Sequelize as SequelizeStatic } from 'sequelize';
import { DataTypes } from 'sequelize';

export interface MigrationContext {
  queryInterface: QueryInterface;
  Sequelize: typeof SequelizeStatic;
}

export interface SolidusMigrations {
  up(context: MigrationContext): Promise<void>;
  down(context: MigrationContext): Promise<void>;
}

export function createSolidusMigrations(options: {
  tablePrefix?: string;
  schema?: string;
} = {}): SolidusMigrations {
  const prefix = options.tablePrefix ?? 'solidus_';
  const schema = options.schema;

  const withSchema = (tableName: string) => {
    return schema ? { schema, tableName: `${prefix}${tableName}` } : `${prefix}${tableName}`;
  };

  const createTableOptions = (transaction: any) => ({
    transaction,
    schema,
  });

  return {
    async up({ queryInterface }) {
      const transaction = await queryInterface.sequelize.transaction();
      try {
        // 1. solidus_customers
        await queryInterface.createTable(withSchema('customers'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          owner_type: { type: DataTypes.STRING, allowNull: false },
          owner_id: { type: DataTypes.STRING, allowNull: false },
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
          processor: { type: DataTypes.STRING, allowNull: false },
          processor_id: { type: DataTypes.STRING, allowNull: false },
          email: { type: DataTypes.STRING, allowNull: true },
          is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
          metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('customers'), {
          fields: ['owner_type', 'owner_id'],
          transaction,
        });

        // 2. solidus_charges
        await queryInterface.createTable(withSchema('charges'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          customer_id: { type: DataTypes.UUID, allowNull: true }, // FK to customers.id (UUID)
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
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
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('charges'), {
          fields: ['processor', 'processor_id'],
          unique: true,
          transaction,
        });
        await queryInterface.addIndex(withSchema('charges'), {
          fields: ['customer_id'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('charges'), {
          fields: ['customer_processor_id'],
          transaction,
        });

        // 3. solidus_subscriptions
        await queryInterface.createTable(withSchema('subscriptions'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          customer_id: { type: DataTypes.UUID, allowNull: true }, // FK to customers.id (UUID)
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
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
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('subscriptions'), {
          fields: ['processor', 'processor_id'],
          unique: true,
          transaction,
        });
        await queryInterface.addIndex(withSchema('subscriptions'), {
          fields: ['customer_id'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('subscriptions'), {
          fields: ['customer_processor_id'],
          transaction,
        });

        // 4. solidus_payment_methods
        await queryInterface.createTable(withSchema('payment_methods'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          customer_id: { type: DataTypes.UUID, allowNull: true }, // FK to customers.id (UUID)
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
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
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('payment_methods'), {
          fields: ['processor', 'processor_id'],
          unique: true,
          transaction,
        });
        await queryInterface.addIndex(withSchema('payment_methods'), {
          fields: ['customer_id'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('payment_methods'), {
          fields: ['customer_processor_id'],
          transaction,
        });

        // 5. solidus_invoices
        await queryInterface.createTable(withSchema('invoices'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
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
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('invoices'), {
          fields: ['processor', 'processor_id'],
          unique: true,
          transaction,
        });

        // 6. solidus_webhook_events
        await queryInterface.createTable(withSchema('webhooks'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
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
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('webhooks'), {
          fields: ['event_id', 'processor'],
          unique: true,
          transaction,
        });

        // 7. solidus_webhook_outbox
        await queryInterface.createTable(withSchema('webhook_outbox'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          merchant_id: { type: DataTypes.BIGINT, allowNull: true },
          job_name: { type: DataTypes.STRING, allowNull: false },
          job_payload: { type: DataTypes.JSONB, allowNull: false },
          job_idempotency_key: { type: DataTypes.STRING, allowNull: true },
          run_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
          processed_at: { type: DataTypes.DATE, allowNull: true }, // Added for index requirement
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('webhook_outbox'), {
          fields: ['run_at', 'processed_at'],
          transaction,
        });

        // 8. solidus_idempotency_keys
        await queryInterface.createTable(withSchema('idempotency_keys'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          key: { type: DataTypes.STRING, allowNull: false },
          scope: { type: DataTypes.STRING, allowNull: false },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        // Index for idempotency keys is on (key, scope) and is unique
        await queryInterface.addIndex(withSchema('idempotency_keys'), {
          fields: ['key', 'scope'],
          unique: true,
          transaction,
        });

        // 9. solidus_stripe_customers
        await queryInterface.createTable(withSchema('stripe_customers'), {
          id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
          // Note: SolidusStripeCustomer belongsTo SolidusCustomer, so it needs a customer_id
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
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('stripe_customers'), {
          fields: ['processor', 'processor_id'],
          unique: true,
          transaction,
        });

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },

    async down({ queryInterface }) {
      // Drop tables in reverse order
      const tables = [
        'stripe_customers',
        'idempotency_keys',
        'webhook_outbox',
        'webhooks', // solidus_webhooks (aliased as 'webhooks' in createTable)
        'invoices',
        'payment_methods',
        'subscriptions',
        'charges',
        'customers',
      ];

      for (const table of tables) {
        await queryInterface.dropTable(withSchema(table));
      }
    },
  };
}
