import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusIdempotencyKey extends Model {
  declare id: string;
  declare key: string;
  declare scope: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusIdempotencyKey(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusIdempotencyKey.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    key: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    scope: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}idempotency_keys`,
    timestamps: true,
    underscored: true,
    schema,
    indexes: [
      { unique: true, fields: ['key', 'scope'] }
    ]
  });
  return SolidusIdempotencyKey;
}
