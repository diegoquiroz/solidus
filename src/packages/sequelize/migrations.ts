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
        // 1. solidus_merchants (pay_merchants equivalent)
        await queryInterface.createTable(withSchema('merchants'), {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          owner_type: { type: DataTypes.STRING, allowNull: false },
          owner_id: { type: DataTypes.STRING, allowNull: false },
          processor: { type: DataTypes.STRING, allowNull: false },
          processor_id: { type: DataTypes.STRING, allowNull: true },
          default: { type: DataTypes.BOOLEAN, allowNull: true },
          data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          type: { type: DataTypes.STRING, allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('merchants'), {
          fields: ['owner_type', 'owner_id'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('merchants'), {
          fields: ['owner_type', 'owner_id', 'processor'],
          transaction,
        });

        // 2. solidus_customers (pay_customers equivalent)
        await queryInterface.createTable(withSchema('customers'), {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          owner_type: { type: DataTypes.STRING, allowNull: false },
          owner_id: { type: DataTypes.STRING, allowNull: false },
          processor: { type: DataTypes.STRING, allowNull: false },
          processor_id: { type: DataTypes.STRING, allowNull: true },
          default: { type: DataTypes.BOOLEAN, allowNull: true },
          data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          stripe_account: { type: DataTypes.STRING, allowNull: true },
          deleted_at: { type: DataTypes.DATE, allowNull: true },
          type: { type: DataTypes.STRING, allowNull: true },
          object: { type: DataTypes.JSONB, allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('customers'), {
          fields: ['processor', 'processor_id'],
          unique: true,
          transaction,
        });
        await queryInterface.addIndex(withSchema('customers'), {
          fields: ['owner_type', 'owner_id', 'deleted_at'],
          unique: true,
          name: 'pay_customer_owner_index',
          transaction,
        });

        // 3. solidus_payment_methods (pay_payment_methods equivalent)
        await queryInterface.createTable(withSchema('payment_methods'), {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          customer_id: { type: DataTypes.BIGINT, allowNull: false },
          processor_id: { type: DataTypes.STRING, allowNull: false },
          default: { type: DataTypes.BOOLEAN, allowNull: true },
          payment_method_type: { type: DataTypes.STRING, allowNull: true },
          data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          stripe_account: { type: DataTypes.STRING, allowNull: true },
          type: { type: DataTypes.STRING, allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('payment_methods'), {
          fields: ['customer_id', 'processor_id'],
          unique: true,
          transaction,
        });
        await queryInterface.addIndex(withSchema('payment_methods'), {
          fields: ['customer_id'],
          unique: true,
          name: 'ux_payment_methods_default_customer',
          where: { default: true },
          transaction,
        });

        // 4. solidus_subscriptions (pay_subscriptions equivalent)
        await queryInterface.createTable(withSchema('subscriptions'), {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          customer_id: { type: DataTypes.BIGINT, allowNull: false },
          name: { type: DataTypes.STRING, allowNull: false },
          processor_id: { type: DataTypes.STRING, allowNull: false },
          processor_plan: { type: DataTypes.STRING, allowNull: false },
          quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
          status: { type: DataTypes.STRING, allowNull: false },
          current_period_start: { type: DataTypes.DATE, allowNull: true },
          current_period_end: { type: DataTypes.DATE, allowNull: true },
          trial_ends_at: { type: DataTypes.DATE, allowNull: true },
          ends_at: { type: DataTypes.DATE, allowNull: true },
          metered: { type: DataTypes.BOOLEAN, allowNull: true },
          pause_behavior: { type: DataTypes.STRING, allowNull: true },
          pause_starts_at: { type: DataTypes.DATE, allowNull: true },
          pause_resumes_at: { type: DataTypes.DATE, allowNull: true },
          application_fee_percent: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
          metadata: { type: DataTypes.JSONB, allowNull: true },
          data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          stripe_account: { type: DataTypes.STRING, allowNull: true },
          payment_method_id: { type: DataTypes.STRING, allowNull: true },
          type: { type: DataTypes.STRING, allowNull: true },
          object: { type: DataTypes.JSONB, allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('subscriptions'), {
          fields: ['customer_id', 'processor_id'],
          unique: true,
          transaction,
        });
        await queryInterface.addIndex(withSchema('subscriptions'), {
          fields: ['metered'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('subscriptions'), {
          fields: ['pause_starts_at'],
          transaction,
        });

        // 5. solidus_charges (pay_charges equivalent)
        await queryInterface.createTable(withSchema('charges'), {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          customer_id: { type: DataTypes.BIGINT, allowNull: false },
          subscription_id: { type: DataTypes.BIGINT, allowNull: true },
          processor_id: { type: DataTypes.STRING, allowNull: false },
          amount: { type: DataTypes.BIGINT, allowNull: false },
          currency: { type: DataTypes.STRING, allowNull: true },
          application_fee_amount: { type: DataTypes.BIGINT, allowNull: true },
          amount_refunded: { type: DataTypes.BIGINT, allowNull: true },
          metadata: { type: DataTypes.JSONB, allowNull: true },
          data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          stripe_account: { type: DataTypes.STRING, allowNull: true },
          type: { type: DataTypes.STRING, allowNull: true },
          object: { type: DataTypes.JSONB, allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('charges'), {
          fields: ['customer_id', 'processor_id'],
          unique: true,
          transaction,
        });

        // 6. solidus_webhooks (pay_webhooks equivalent with retry management)
        await queryInterface.createTable(withSchema('webhooks'), {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          processor: { type: DataTypes.STRING, allowNull: true },
          event_id: { type: DataTypes.STRING, allowNull: true },
          event_type: { type: DataTypes.STRING, allowNull: true },
          event: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
          type: { type: DataTypes.STRING, allowNull: true },
          attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          received_at: { type: DataTypes.DATE, allowNull: false },
          processed_at: { type: DataTypes.DATE, allowNull: true },
          next_attempt_at: { type: DataTypes.DATE, allowNull: true },
          last_error: { type: DataTypes.TEXT, allowNull: true },
          dead_lettered_at: { type: DataTypes.DATE, allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false },
        }, createTableOptions(transaction));

        await queryInterface.addIndex(withSchema('webhooks'), {
          fields: ['processor'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('webhooks'), {
          fields: ['event_type'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('webhooks'), {
          fields: ['created_at'],
          transaction,
        });
        await queryInterface.addIndex(withSchema('webhooks'), {
          fields: ['processor', 'event_id'],
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
        'webhooks',
        'charges',
        'subscriptions',
        'payment_methods',
        'customers',
        'merchants',
      ];

      for (const table of tables) {
        await queryInterface.dropTable(withSchema(table));
      }
    },
  };
}
