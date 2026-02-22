import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusWebhookEvent extends Model {
  declare id: string;
  declare merchantId?: string;
  declare processor: string;
  declare eventId: string;
  declare eventType: string;
  declare payload: Record<string, unknown>;
  declare receivedAt: Date;
  declare processedAt?: Date;
  declare attemptCount: number;
  declare nextAttemptAt?: Date;
  declare lastError?: string;
  declare deadLetteredAt?: Date;
  declare failureCount: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusWebhookEvent(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusWebhookEvent.init({
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
    eventId: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'event_id' 
    },
    eventType: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'event_type' 
    },
    payload: { 
      type: DataTypes.JSONB, 
      allowNull: false 
    },
    receivedAt: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW, 
      field: 'received_at' 
    },
    processedAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'processed_at' 
    },
    attemptCount: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 0, 
      field: 'attempt_count' 
    },
    nextAttemptAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'next_attempt_at' 
    },
    lastError: { 
      type: DataTypes.TEXT, 
      allowNull: true, 
      field: 'last_error' 
    },
    deadLetteredAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'dead_lettered_at' 
    },
    failureCount: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 0, 
      field: 'failure_count' 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}webhooks`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusWebhookEvent;
}
