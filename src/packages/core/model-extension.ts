import type { ChargeRecord, SubscriptionRecord } from "./contracts.ts";
import type { SolidusFacade } from "./global-facade.ts";
import { getGlobalFacade, SolidusNotConfiguredError } from "./global-facade.ts";

export interface OwnerContext {
  ownerType: string;
  ownerId: string;
}

export interface BillingMixinOptions<TOwner> {
  ownerType: string;
  getOwnerId: (instance: TOwner) => string;
  facade?: SolidusFacade;
}

export interface BillingOperations {
  setProcessor(customerId?: string): Promise<{
    owner: { ownerType: string; ownerId: string };
    processor: "stripe";
    customerId: string;
    customer: import("stripe").Stripe.Customer;
  }>;

  charge(input: {
    amount: number;
    currency: string;
    customerId?: string;
    paymentMethodId?: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<ChargeRecord>;

  subscribe(input: {
    priceId: string;
    customerId?: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }): Promise<SubscriptionRecord>;

  syncCustomer(): Promise<import("stripe").Stripe.Customer | null>;

  syncSubscriptions(limit?: number): Promise<readonly import("stripe").Stripe.Subscription[]>;

  getCustomerId(): Promise<string | null>;
}

class BillingOperationsImpl implements BillingOperations {
  private ownerType: string;
  private ownerId: string;
  private facade: SolidusFacade | undefined;

  constructor(ownerType: string, ownerId: string, facade?: SolidusFacade) {
    this.ownerType = ownerType;
    this.ownerId = ownerId;
    this.facade = facade;
  }

  private getFacade(): SolidusFacade {
    if (this.facade !== undefined) {
      return this.facade;
    }
    return getGlobalFacade();
  }

  private getContext() {
    return {
      ownerType: this.ownerType,
      ownerId: this.ownerId,
    };
  }

  async setProcessor(customerId?: string) {
    const facade = this.getFacade();
    return facade.convenience.setOwnerStripeProcessor({
      ...this.getContext(),
      customerId,
    });
  }

  async charge(input: {
    amount: number;
    currency: string;
    customerId?: string;
    paymentMethodId?: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<ChargeRecord> {
    const facade = this.getFacade();

    let customerId = input.customerId;
    if (customerId === undefined) {
      const existing = await facade.convenience.syncCustomer(this.getContext());
      if (existing !== null) {
        customerId = existing.id;
      }
    }

    if (customerId === undefined) {
      const newCustomer = await this.setProcessor();
      customerId = newCustomer.customerId;
    }

    return facade.api.charges.charge({
      customerId,
      amount: input.amount,
      currency: input.currency,
      paymentMethodId: input.paymentMethodId,
      description: input.description,
      metadata: input.metadata,
    });
  }

  async subscribe(input: {
    priceId: string;
    customerId?: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }): Promise<SubscriptionRecord> {
    const facade = this.getFacade();

    let customerId = input.customerId;
    if (customerId === undefined) {
      const existing = await facade.convenience.syncCustomer(this.getContext());
      if (existing !== null) {
        customerId = existing.id;
      }
    }

    if (customerId === undefined) {
      const newCustomer = await this.setProcessor();
      customerId = newCustomer.customerId;
    }

    return facade.api.subscriptions.create({
      customerId,
      priceId: input.priceId,
      quantity: input.quantity,
      metadata: input.metadata,
    });
  }

  async syncCustomer() {
    const facade = this.getFacade();
    return facade.convenience.syncCustomer(this.getContext());
  }

  async syncSubscriptions(limit?: number) {
    const facade = this.getFacade();
    return facade.convenience.syncSubscriptions({
      ...this.getContext(),
      limit,
    });
  }

  async getCustomerId(): Promise<string | null> {
    const facade = this.getFacade();
    const customer = await facade.convenience.syncCustomer(this.getContext());
    return customer?.id ?? null;
  }
}

export type BillingMixin<TOwner> = (instance: TOwner) => BillingOperations;

export function createBillingMixin<TOwner>(
  options: BillingMixinOptions<TOwner>,
): BillingMixin<TOwner> {
  return (instance: TOwner): BillingOperations => {
    const ownerId = options.getOwnerId(instance);
    return new BillingOperationsImpl(options.ownerType, ownerId, options.facade);
  };
}

export function solidusBillingMixin<TOwner>(
  options: BillingMixinOptions<TOwner>,
): BillingMixin<TOwner> {
  return createBillingMixin(options);
}

export { SolidusNotConfiguredError };
