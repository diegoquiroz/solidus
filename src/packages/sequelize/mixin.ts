import type { FindOptions, Model } from 'sequelize';
import type { BillingOperations } from '../core/model-extension.ts';
import { BillingOperationsImpl } from '../core/model-extension.ts';
import type { SolidusFacade } from '../core/global-facade.ts';
import { getGlobalFacade } from '../core/global-facade.ts';
import {
  SolidusCustomer,
  SolidusCharge,
  SolidusSubscription,
} from './models/index.ts';

export interface SolidusBillingOptions<TOwner> {
  ownerType: string;
  getOwnerId: (instance: TOwner) => string;
  facade?: SolidusFacade;
}

interface SequelizeModelStatic<M extends Model = Model> {
  hasMany: (model: unknown, options: Record<string, unknown>) => void;
  findAll: (options: FindOptions) => Promise<M[]>;
  scope: (name: string) => SequelizeModelStatic<M>;
  prototype: M;
}

export function solidusBilling<TOwner extends Model>(
  model: SequelizeModelStatic<TOwner>,
  options: SolidusBillingOptions<TOwner>,
): void {
  model.hasMany(SolidusCustomer, {
    foreignKey: 'owner_id',
    constraints: false,
    scope: { owner_type: options.ownerType },
  });

  model.hasMany(SolidusCharge, {
    foreignKey: 'owner_id',
    constraints: false,
    scope: { owner_type: options.ownerType },
  });

  model.hasMany(SolidusSubscription, {
    foreignKey: 'owner_id',
    constraints: false,
    scope: { owner_type: options.ownerType },
  });

  Object.defineProperty(model.prototype, 'billing', {
    configurable: true,
    get(): BillingOperations {
      const ownerId = options.getOwnerId(this as TOwner);
      const facade = options.facade ?? getGlobalFacade();
      return new BillingOperationsImpl(options.ownerType, ownerId, facade);
    },
  });

  (model as unknown as Record<string, unknown>).findWithBilling = async function (
    findOptions?: FindOptions,
  ): Promise<TOwner[]> {
    return model.findAll({
      ...findOptions,
      include: [
        { model: SolidusCustomer, required: false },
        { model: SolidusCharge, required: false },
        { model: SolidusSubscription, required: false },
      ],
    });
  };

  (model as unknown as Record<string, unknown>).billingScope = function (): SequelizeModelStatic<TOwner> {
    return model.scope('withBilling');
  };
}

declare module 'sequelize' {
  interface Model {
    billing: BillingOperations;
  }
}
