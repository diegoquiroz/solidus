import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusCharge extends Model {
  declare id: string;
  declare customerId?: string;
  declare merchantId?: string;
  declare processor: string;
  declare processorId: string;
  declare customerProcessorId: string;
  declare amount: number;
  declare currency: string;
  declare status: string;
  declare capturedAt?: Date;
  declare receiptUrl?: string;
  declare taxAmount?: number;
  declare totalTaxAmounts?: Record<string, unknown>;
  declare refundTotal?: number;
  declare paymentMethodSnapshot?: Record<string, unknown>;
  declare rawPayload: Record<string, unknown>;
  declare metadata: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusCharge(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusCharge.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    customerId: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'customer_id' 
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
      allowNull: false, 
      field: 'customer_processor_id' 
    },
    amount: { 
      type: DataTypes.BIGINT, 
      allowNull: false 
    },
    currency: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    status: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    capturedAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'captured_at' 
    },
    receiptUrl: { 
      type: DataTypes.TEXT, 
      allowNull: true, 
      field: 'receipt_url' 
    },
    taxAmount: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'tax_amount' 
    },
    totalTaxAmounts: { 
      type: DataTypes.JSONB, 
      allowNull: true, 
      field: 'total_tax_amounts' 
    },
    refundTotal: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'refund_total' 
    },
    paymentMethodSnapshot: { 
      type: DataTypes.JSONB, 
      allowNull: true, 
      field: 'payment_method_snapshot' 
    },
    rawPayload: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      field: 'raw_payload' 
    },
    metadata: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {},
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}charges`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusCharge;
}
