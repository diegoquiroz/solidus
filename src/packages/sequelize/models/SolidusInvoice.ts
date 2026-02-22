import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusInvoice extends Model {
  declare id: string;
  declare merchantId?: string;
  declare processor: string;
  declare processorId: string;
  declare customerProcessorId?: string;
  declare subscriptionProcessorId?: string;
  declare status: string;
  declare amountDue?: number;
  declare amountPaid?: number;
  declare currency?: string;
  declare dueAt?: Date;
  declare paidAt?: Date;
  declare rawPayload: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusInvoice(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusInvoice.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    merchantId: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'merchant_id' 
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
    customerProcessorId: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'customer_processor_id' 
    },
    subscriptionProcessorId: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'subscription_processor_id' 
    },
    status: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    amountDue: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'amount_due' 
    },
    amountPaid: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'amount_paid' 
    },
    currency: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    dueAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'due_at' 
    },
    paidAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'paid_at' 
    },
    rawPayload: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      field: 'raw_payload' 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}invoices`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusInvoice;
}
