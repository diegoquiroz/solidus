import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusWebhookEvent extends Model {
  declare id: number;
  declare processor?: string;
  declare eventId?: string;
  declare eventType?: string;
  declare event: Record<string, unknown>;
  declare type?: string;
  declare attemptCount: number;
  declare receivedAt: Date;
  declare processedAt?: Date;
  declare nextAttemptAt?: Date;
  declare lastError?: string;
  declare deadLetteredAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusWebhookEvent(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusWebhookEvent.init({
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    processor: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    eventId: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'event_id' 
    },
    eventType: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'event_type' 
    },
    event: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {} 
    },
    type: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    attemptCount: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 0,
      field: 'attempt_count'
    },
    receivedAt: { 
      type: DataTypes.DATE, 
      allowNull: false,
      field: 'received_at'
    },
    processedAt: { 
      type: DataTypes.DATE, 
      allowNull: true,
      field: 'processed_at'
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
  }, {
    sequelize,
    tableName: `${tablePrefix}webhooks`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusWebhookEvent;
}
