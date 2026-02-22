import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusMerchant extends Model {
  declare id: number;
  declare ownerType: string;
  declare ownerId: string;
  declare processor: string;
  declare processorId?: string;
  declare default?: boolean;
  declare data: Record<string, unknown>;
  declare type?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusMerchant(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusMerchant.init({
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    ownerType: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'owner_type' 
    },
    ownerId: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      field: 'owner_id' 
    },
    processor: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    processorId: { 
      type: DataTypes.STRING, 
      allowNull: true, 
      field: 'processor_id' 
    },
    default: { 
      type: DataTypes.BOOLEAN, 
      allowNull: true, 
      field: 'default' 
    },
    data: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {} 
    },
    type: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}merchants`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusMerchant;
}
