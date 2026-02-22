import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusWebhookOutbox extends Model {
  declare id: string;
  declare merchantId?: string;
  declare jobName: string;
  declare jobPayload: Record<string, unknown>;
  declare jobIdempotencyKey?: string;
  declare runAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusWebhookOutbox(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusWebhookOutbox.init({
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
    jobName: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'job_name' 
    },
    jobPayload: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      field: 'job_payload' 
    },
    jobIdempotencyKey: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'job_idempotency_key' 
    },
    runAt: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW, 
      field: 'run_at' 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}webhook_outbox`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusWebhookOutbox;
}
