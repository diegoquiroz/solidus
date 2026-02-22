import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusPaymentMethod extends Model {
  declare id: string;
  declare customerId?: string;
  declare merchantId?: string;
  declare processor: string;
  declare processorId: string;
  declare customerProcessorId: string;
  declare methodType: string;
  declare brand?: string;
  declare last4?: string;
  declare expMonth?: number;
  declare expYear?: number;
  declare isDefault: boolean;
  declare metadata: Record<string, unknown>;
  declare rawPayload: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusPaymentMethod(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusPaymentMethod.init({
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
    methodType: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'method_type' 
    },
    brand: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    last4: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'last4' 
    },
    expMonth: { 
      type: DataTypes.INTEGER, 
      allowNull: true, 
      field: 'exp_month' 
    },
    expYear: { 
      type: DataTypes.INTEGER, 
      allowNull: true, 
      field: 'exp_year' 
    },
    isDefault: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: false, 
      field: 'is_default' 
    },
    metadata: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {},
    },
    rawPayload: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      field: 'raw_payload' 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}payment_methods`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusPaymentMethod;
}
