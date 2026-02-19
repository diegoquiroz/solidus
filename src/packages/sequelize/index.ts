import { ConfigurationError } from "../core/errors.ts";
export {
  m1FoundationSchema,
  type ColumnSpec,
  type SchemaSpec,
  type TableSpec,
} from "../../../packages/sequelize/src/schema.ts";

export interface SequelizeAdapterPlaceholder {
  readonly orm: "sequelize";
  readonly status: "not_implemented";
}

export function createSequelizeAdapterPlaceholder(): SequelizeAdapterPlaceholder {
  return {
    orm: "sequelize",
    status: "not_implemented",
  };
}

export function assertSequelizeAdapterImplemented(): never {
  throw new ConfigurationError("Sequelize adapter is not implemented yet.");
}
