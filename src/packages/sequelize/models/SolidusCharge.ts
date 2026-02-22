import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusCharge extends Model {
  declare id: number;
  declare customerId: number;
  declare subscriptionId?: number;
  declare processorId: string;
  declare amount: number;
  declare currency?: string;
  declare applicationFeeAmount?: number;
  declare amountRefunded?: number;
  declare metadata?: Record<string, unknown>;
  declare data: Record<string, unknown>;
  declare stripeAccount?: string;
  declare type?: string;
  declare object?: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusCharge(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusCharge.init({
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
    subscriptionId: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'subscription_id' 
    },
    processorId: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'processor_id' 
    },
    amount: { 
      type: DataTypes.BIGINT, 
      allowNull: false 
    },
    currency: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    applicationFeeAmount: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'application_fee_amount' 
    },
    amountRefunded: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      field: 'amount_refunded' 
    },
    metadata: { 
      type: DataTypes.JSONB, 
      allowNull: true 
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
    object: { 
      type: DataTypes.JSONB, 
      allowNull: true 
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
