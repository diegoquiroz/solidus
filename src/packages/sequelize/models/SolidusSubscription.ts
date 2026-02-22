import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusSubscription extends Model {
  declare id: string;
  declare customerId?: string;
  declare merchantId?: string;
  declare processor: string;
  declare processorId: string;
  declare customerProcessorId: string;
  declare status: string;
  declare planCode?: string;
  declare priceId?: string;
  declare quantity: number;
  declare cancelAtPeriodEnd: boolean;
  declare currentPeriodStart?: Date;
  declare currentPeriodEnd?: Date;
  declare trialEndsAt?: Date;
  declare pausedBehavior?: 'void' | 'keep_as_draft' | 'mark_uncollectible';
  declare pausedResumesAt?: Date;
  declare rawPayload: Record<string, unknown>;
  declare canceledAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusSubscription(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusSubscription.init({
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
    status: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    planCode: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'plan_code' 
    },
    priceId: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'price_id' 
    },
    quantity: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 1 
    },
    cancelAtPeriodEnd: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: false, 
      field: 'cancel_at_period_end' 
    },
    currentPeriodStart: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'current_period_start' 
    },
    currentPeriodEnd: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'current_period_end' 
    },
    trialEndsAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'trial_ends_at' 
    },
    pausedBehavior: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'paused_behavior' 
    },
    pausedResumesAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'paused_resumes_at' 
    },
    rawPayload: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      field: 'raw_payload' 
    },
    canceledAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'canceled_at' 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}subscriptions`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusSubscription;
}
