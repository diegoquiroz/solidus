import { describe, expect, test } from "bun:test";
import type Stripe from "stripe";
import type { CustomerRecord, CustomerRepository } from "../../core/contracts.ts";
import type { StripeCustomerProjection } from "../../stripe/core-apis.ts";
import { createSolidusFacade } from "../index.ts";

class InMemoryOwnerCustomerRepository implements CustomerRepository {
  readonly values = new Map<string, CustomerRecord>();

  async save(customer: CustomerRecord): Promise<void> {
    this.values.set(`${customer.ownerType}:${customer.ownerId}:${customer.processor}`, customer);
  }

  async findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null> {
    for (const customer of this.values.values()) {
      if (customer.ownerType !== input.ownerType || customer.ownerId !== input.ownerId) {
        continue;
      }

      if (input.processor !== undefined && customer.processor !== input.processor) {
        continue;
      }

      return customer;
    }

    return null;
  }
}

function makeEvent(type: string, id: string): Stripe.Event {
  return {
    id: `evt_${type.replace(/[^a-z0-9]+/gi, "_")}`,
    object: "event",
    type,
    data: {
      object: {
        id,
      },
    },
  } as Stripe.Event;
}

describe("facade package", () => {
  test("creates facade with stripe api and webhook processor", () => {
    const stripe = {} as Stripe;
    const facade = createSolidusFacade({ stripe });

    expect(typeof facade.api.customers.create).toBe("function");
    expect(typeof facade.api.subscriptions.create).toBe("function");
    expect(typeof facade.webhooks.process).toBe("function");
    expect(facade.webhooks.delegator.listening("charge.succeeded")).toBe(false);
  });

  test("supports additive webhook registration while preserving custom overrides", async () => {
    const customers = new Map<string, StripeCustomerProjection>();
    let defaultSyncCalls = 0;
    let customSyncCalls = 0;

    const stripe = {
      customers: {
        retrieve: async (_id: string) => {
          defaultSyncCalls += 1;
          return {
            id: "cus_1",
            object: "customer",
            metadata: {},
            invoice_settings: {},
          } as unknown as Stripe.Customer;
        },
      },
    } as unknown as Stripe;

    const facade = createSolidusFacade({
      stripe,
      repositories: {
        customers: {
          async upsert(customer) {
            customers.set(customer.processorId, customer);
          },
        },
      },
      webhookRegistration: {
        effects: {
          async syncCustomerById() {
            customSyncCalls += 1;
          },
        },
      },
    });

    await facade.webhooks.process(makeEvent("customer.updated", "cus_1"));

    expect(customSyncCalls).toBe(1);
    expect(defaultSyncCalls).toBe(0);
    expect(customers.size).toBe(0);
  });

  test("propagates Stripe connected account context through default effects", async () => {
    const customers = new Map<string, StripeCustomerProjection>();
    let seenRequestOptions: Stripe.RequestOptions | undefined;

    const stripe = {
      customers: {
        retrieve: async (_id: string, requestOptions?: Stripe.RequestOptions) => {
          seenRequestOptions = requestOptions;
          return {
            id: "cus_1",
            object: "customer",
            metadata: {},
            invoice_settings: {},
          } as unknown as Stripe.Customer;
        },
      },
    } as unknown as Stripe;

    const facade = createSolidusFacade({
      stripe,
      repositories: {
        customers: {
          async upsert(customer) {
            customers.set(customer.processorId, customer);
          },
        },
      },
    });

    const event = makeEvent("customer.updated", "cus_1");
    event.account = "acct_123";
    await facade.webhooks.process(event);

    expect(seenRequestOptions?.stripeAccount).toBe("acct_123");
    expect(customers.get("cus_1")?.processorId).toBe("cus_1");
  });

  test("resolves connected account context per customer for convenience sync calls", async () => {
    const ownerCustomers = new InMemoryOwnerCustomerRepository();
    await ownerCustomers.save({
      id: "owner_1",
      ownerType: "User",
      ownerId: "1",
      processor: "stripe",
      processorId: "cus_1",
    });
    await ownerCustomers.save({
      id: "owner_2",
      ownerType: "User",
      ownerId: "2",
      processor: "stripe",
      processorId: "cus_2",
    });

    const customerProjections = new Map<string, StripeCustomerProjection>();
    customerProjections.set("cus_1", {
      processor: "stripe",
      processorId: "cus_1",
      connectedAccountId: "acct_1",
      rawPayload: { id: "cus_1" } as Stripe.Customer,
    });
    customerProjections.set("cus_2", {
      processor: "stripe",
      processorId: "cus_2",
      connectedAccountId: "acct_2",
      rawPayload: { id: "cus_2" } as Stripe.Customer,
    });

    const seenCustomerRetrieveOptions = new Map<string, string | undefined>();
    const seenSubscriptionsListOptions = new Map<string, string | undefined>();
    const seenSubscriptionRetrieveOptions = new Map<string, string | undefined>();

    const stripe = {
      customers: {
        retrieve: async (customerId: string, requestOptions?: Stripe.RequestOptions) => {
          seenCustomerRetrieveOptions.set(customerId, requestOptions?.stripeAccount);
          return {
            id: customerId,
            object: "customer",
            metadata: {},
            invoice_settings: {},
          } as unknown as Stripe.Customer;
        },
      },
      subscriptions: {
        list: async (
          params: { customer?: string; limit?: number },
          requestOptions?: Stripe.RequestOptions,
        ) => {
          if (typeof params.customer === "string") {
            seenSubscriptionsListOptions.set(params.customer, requestOptions?.stripeAccount);
          }

          return {
            data: [
              {
                id: `sub_${params.customer}`,
                customer: params.customer,
                status: "active",
                cancel_at_period_end: false,
                items: {
                  data: [
                    {
                      price: { id: "price_basic" },
                      quantity: 1,
                    },
                  ],
                },
              },
            ],
          };
        },
        retrieve: async (subscriptionId: string, requestOptions?: Stripe.RequestOptions) => {
          seenSubscriptionRetrieveOptions.set(subscriptionId, requestOptions?.stripeAccount);
          const customerId = subscriptionId.replace("sub_", "");

          return {
            id: subscriptionId,
            customer: customerId,
            status: "active",
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: { id: "price_basic" },
                  quantity: 1,
                },
              ],
            },
          };
        },
      },
    } as unknown as Stripe;

    const facade = createSolidusFacade({
      stripe,
      ownerCustomers,
      repositories: {
        customers: {
          async upsert(customer) {
            customerProjections.set(customer.processorId, customer);
          },
          async findByProcessorId(processorId) {
            return customerProjections.get(processorId) ?? null;
          },
        },
        subscriptions: {
          async upsert() {},
          async findByProcessorId() {
            return null;
          },
          async listByCustomer() {
            return [];
          },
        },
      },
    });

    await facade.convenience.syncCustomer({ ownerType: "User", ownerId: "1" });
    await facade.convenience.syncSubscriptions({ ownerType: "User", ownerId: "1" });
    await facade.convenience.syncCustomer({ ownerType: "User", ownerId: "2" });
    await facade.convenience.syncSubscriptions({ ownerType: "User", ownerId: "2" });

    expect(seenCustomerRetrieveOptions.get("cus_1")).toBe("acct_1");
    expect(seenSubscriptionsListOptions.get("cus_1")).toBe("acct_1");
    expect(seenSubscriptionRetrieveOptions.get("sub_cus_1")).toBe("acct_1");
    expect(seenCustomerRetrieveOptions.get("cus_2")).toBe("acct_2");
    expect(seenSubscriptionsListOptions.get("cus_2")).toBe("acct_2");
    expect(seenSubscriptionRetrieveOptions.get("sub_cus_2")).toBe("acct_2");
    expect(seenCustomerRetrieveOptions.get("cus_2")).not.toBe("acct_1");
  });

  test("convenience setOwnerStripeProcessor creates owner-linked Stripe customer", async () => {
    const ownerCustomers = new InMemoryOwnerCustomerRepository();
    let createCalls = 0;

    const stripe = {
      customers: {
        create: async () => {
          createCalls += 1;
          return {
            id: "cus_owner_1",
            object: "customer",
            email: "owner@example.com",
            metadata: { role: "owner" },
            invoice_settings: {},
          } as unknown as Stripe.Customer;
        },
      },
    } as unknown as Stripe;

    const facade = createSolidusFacade({
      stripe,
      ownerCustomers,
    });

    const assignment = await facade.convenience.setOwnerStripeProcessor({
      ownerType: "User",
      ownerId: "42",
      customer: {
        email: "owner@example.com",
        metadata: { role: "owner" },
      },
    });

    const persisted = await ownerCustomers.findByOwner({ ownerType: "User", ownerId: "42", processor: "stripe" });
    expect(createCalls).toBe(1);
    expect(assignment.customerId).toBe("cus_owner_1");
    expect(persisted?.processorId).toBe("cus_owner_1");
  });

  test("convenience syncCustomer and syncSubscriptions reconcile owner-linked records", async () => {
    const ownerCustomers = new InMemoryOwnerCustomerRepository();
    await ownerCustomers.save({
      id: "owner_42",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_sync_1",
      email: "sync@example.com",
    });

    const customerProjections = new Map<string, StripeCustomerProjection>();
    const subscriptionProjections = new Map<string, { processorId: string }>();
    let customerRetrieveCalls = 0;

    const stripe = {
      customers: {
        retrieve: async () => {
          customerRetrieveCalls += 1;
          return {
            id: "cus_sync_1",
            object: "customer",
            email: "sync@example.com",
            metadata: {},
            invoice_settings: {},
          } as unknown as Stripe.Customer;
        },
      },
      subscriptions: {
        list: async () => ({
          data: [
            {
              id: "sub_sync_1",
              customer: "cus_sync_1",
              status: "active",
              cancel_at_period_end: false,
              items: {
                data: [
                  {
                    price: { id: "price_basic" },
                    quantity: 1,
                  },
                ],
              },
            },
          ],
        }),
        retrieve: async () => ({
          id: "sub_sync_1",
          customer: "cus_sync_1",
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                price: { id: "price_basic" },
                quantity: 1,
              },
            ],
          },
        }),
      },
    } as unknown as Stripe;

    const facade = createSolidusFacade({
      stripe,
      ownerCustomers,
      repositories: {
        customers: {
          async upsert(customer) {
            customerProjections.set(customer.processorId, customer);
          },
        },
        subscriptions: {
          async upsert(subscription) {
            subscriptionProjections.set(subscription.processorId, { processorId: subscription.processorId });
          },
          async findByProcessorId() {
            return null;
          },
          async listByCustomer() {
            return [];
          },
        },
      },
    });

    const customer = await facade.convenience.syncCustomer({ ownerType: "User", ownerId: "42" });
    const subscriptions = await facade.convenience.syncSubscriptions({ ownerType: "User", ownerId: "42" });

    expect(customer?.id).toBe("cus_sync_1");
    expect(customerRetrieveCalls).toBeGreaterThan(0);
    expect(customerProjections.get("cus_sync_1")?.processorId).toBe("cus_sync_1");
    expect(subscriptions[0]?.id).toBe("sub_sync_1");
    expect(subscriptionProjections.get("sub_sync_1")?.processorId).toBe("sub_sync_1");
  });
});
