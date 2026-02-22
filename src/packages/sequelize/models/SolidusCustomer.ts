import { Model, DataTypes, Sequelize } from 'sequelize';

export class SolidusCustomer extends Model {
  declare id: string;
  declare ownerType: string;
  declare ownerId: string;
  declare merchantId?: string;
  declare processor: string;
  declare processorId: string;
  declare email?: string;
  declare isDefault: boolean;
  declare metadata: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initSolidusCustomer(sequelize: Sequelize, tablePrefix = 'solidus_', schema?: string) {
  SolidusCustomer.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
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
    email: { 
      type: DataTypes.STRING, 
      allowNull: true 
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
      defaultValue: {} 
    },
  }, {
    sequelize,
    tableName: `${tablePrefix}customers`,
    timestamps: true,
    underscored: true,
    schema,
  });
  return SolidusCustomer;
}
