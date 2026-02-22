import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusPaymentMethod extends Model {
  declare id: number;
  declare customerId: number;
  declare processorId: string;
  declare default?: boolean;
  declare paymentMethodType?: string;
  declare data: Record<string, unknown>;
  declare stripeAccount?: string;
  declare type?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusPaymentMethod(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusPaymentMethod.init({
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    customerId: { 
      type: DataTypes.BIGINT, 
      allowNull: false, 
      field: 'customer_id' 
    },
    processorId: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'processor_id' 
    },
    default: { 
      type: DataTypes.BOOLEAN, 
      allowNull: true, 
      field: 'default' 
    },
    paymentMethodType: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'payment_method_type' 
    },
    data: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {} 
    },
    stripeAccount: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'stripe_account' 
    },
    type: { 
      type: DataTypes.STRING, 
      allowNull: true 
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
