import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusStripeCustomer extends Model {
  declare id: string;
  declare processor: string;
  declare processorId: string;
  declare email?: string;
  declare name?: string;
  declare description?: string;
  declare phone?: string;
  declare balance?: number;
  declare currency?: string;
  declare delinquent?: boolean;
  declare invoicePrefix?: string;
  declare rawPayload: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusStripeCustomer(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusStripeCustomer.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    processor: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    processorId: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'processor_id' 
    },
    email: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    name: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    description: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
    phone: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    balance: { 
      type: DataTypes.BIGINT, 
      allowNull: true 
    },
    currency: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    delinquent: { 
      type: DataTypes.BOOLEAN, 
      allowNull: true 
    },
    invoicePrefix: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'invoice_prefix' 
    },
    rawPayload: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      field: 'raw_payload' 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}stripe_customers`,
    timestamps: true,
    underscored: true,
    schema,
    indexes: [
      { unique: true, fields: ['processor', 'processor_id'] }
    ]
  });
  return SolidusStripeCustomer;
}
