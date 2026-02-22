import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusSubscription extends Model {
  declare id: number;
  declare customerId: number;
  declare name: string;
  declare processorId: string;
  declare processorPlan: string;
  declare quantity: number;
  declare status: string;
  declare currentPeriodStart?: Date;
  declare currentPeriodEnd?: Date;
  declare trialEndsAt?: Date;
  declare endsAt?: Date;
  declare metered?: boolean;
  declare pauseBehavior?: string;
  declare pauseStartsAt?: Date;
  declare pauseResumesAt?: Date;
  declare applicationFeePercent?: number;
  declare metadata?: Record<string, unknown>;
  declare data: Record<string, unknown>;
  declare stripeAccount?: string;
  declare paymentMethodId?: string;
  declare type?: string;
  declare object?: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusSubscription(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusSubscription.init({
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
    name: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    processorId: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'processor_id' 
    },
    processorPlan: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'processor_plan' 
    },
    quantity: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 1 
    },
    status: { 
      type: DataTypes.STRING, 
      allowNull: false 
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
    endsAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'ends_at' 
    },
    metered: { 
      type: DataTypes.BOOLEAN, 
      allowNull: true 
    },
    pauseBehavior: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'pause_behavior' 
    },
    pauseStartsAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'pause_starts_at' 
    },
    pauseResumesAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'pause_resumes_at' 
    },
    applicationFeePercent: { 
      type: DataTypes.DECIMAL(8, 2), 
      allowNull: true, 
      field: 'application_fee_percent' 
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
    paymentMethodId: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'payment_method_id' 
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
    tableName: `${tablePrefix}subscriptions`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusSubscription;
}
