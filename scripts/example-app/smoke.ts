import type Stripe from "stripe";
import {
  ActionRequiredError,
  createCustomerRegistry,
  createDbOutboxQueueAdapter,
  createPersistFirstWebhookPipeline,
  createSolidusFacade,
  drainDbOutboxQueue,
  registerCustomerModel,
  type CustomerRecord,
  type CustomerRepository,
  type DbOutboxRepository,
  type IdempotencyRepository,
  type PersistedWebhookEvent,
  type QueueJob,
  type StripeCustomerProjection,
  type StripeCustomerProjectionRepository,
  type SubscriptionRecord,
  type SubscriptionRepository,
  type WebhookEventRepository,
} from "../../index.ts";

interface InvoiceProjectionRecord {
  id: string;
  processor: "stripe";
  processorId: string;
  customerProcessorId?: string;
  subscriptionProcessorId?: string;
  status: string;
  amountDue?: number;
  amountPaid?: number;
  currency?: string;
  dueAt?: Date;
  paidAt?: Date;
  rawPayload: Stripe.Invoice;
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly keys = new Set<string>();

  async reserve(input: { key: string; scope: string }): Promise<"created" | "exists"> {
    const scoped = `${input.scope}:${input.key}`;

    if (this.keys.has(scoped)) {
      return "exists";
    }

    this.keys.add(scoped);
    return "created";
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    this.keys.delete(`${input.scope}:${input.key}`);
  }
}

class InMemoryWebhookRepository implements WebhookEventRepository {
  private readonly events = new Map<string, PersistedWebhookEvent>();

  private key(input: { processor: string; eventId: string }): string {
    return `${input.processor}:${input.eventId}`;
  }

  async persist(event: {
    processor: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
  }): Promise<"created" | "exists"> {
    const key = this.key(event);

    if (this.events.has(key)) {
      return "exists";
    }

    this.events.set(key, {
      id: `wh_${this.events.size + 1}`,
      processor: event.processor,
      eventId: event.eventId,
      eventType: event.eventType,
      payload: event.payload,
      receivedAt: event.receivedAt,
      attemptCount: 0,
    });

    return "created";
  }

  async findByEventId(input: { processor: string; eventId: string }): Promise<PersistedWebhookEvent | null> {
    return this.events.get(this.key(input)) ?? null;
  }

  async markProcessed(input: { processor: string; eventId: string; processedAt: Date }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.processedAt = input.processedAt;
    }
  }

  async markRetrying(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    nextAttemptAt: Date;
    lastError: string;
  }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.attemptCount = input.attemptCount;
      event.nextAttemptAt = input.nextAttemptAt;
      event.lastError = input.lastError;
    }
  }

  async markDeadLetter(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    deadLetteredAt: Date;
    lastError: string;
  }): Promise<void> {
    const event = await this.findByEventId(input);

    if (event !== null) {
      event.attemptCount = input.attemptCount;
      event.deadLetteredAt = input.deadLetteredAt;
      event.lastError = input.lastError;
    }
  }
}

class InMemoryOutbox implements DbOutboxRepository {
  private readonly jobs: Array<{ id: string; job: QueueJob; runAt: Date }> = [];

  async enqueue(input: { job: QueueJob; runAt: Date }): Promise<{ jobId: string }> {
    const id = `job_${this.jobs.length + 1}`;
    this.jobs.push({ id, ...input });
    return { jobId: id };
  }

  async claimReady(input: { now: Date; limit: number }): Promise<readonly { id: string; job: QueueJob; runAt: Date }[]> {
    return this.jobs.filter((entry) => entry.runAt.getTime() <= input.now.getTime()).slice(0, input.limit);
  }

  async acknowledge(jobId: string): Promise<void> {
    const index = this.jobs.findIndex((entry) => entry.id === jobId);

    if (index >= 0) {
      this.jobs.splice(index, 1);
    }
  }
}

class InMemoryCustomerProjectionRepository implements StripeCustomerProjectionRepository {
  private readonly customers = new Map<string, StripeCustomerProjection>();

  async upsert(customer: StripeCustomerProjection): Promise<void> {
    this.customers.set(customer.processorId, customer);
  }

  async findByProcessorId(processorId: string): Promise<StripeCustomerProjection | null> {
    return this.customers.get(processorId) ?? null;
  }
}

class InMemoryOwnerCustomerRepository implements CustomerRepository {
  private readonly customersByOwner = new Map<string, CustomerRecord>();
  saveCalls = 0;

  async save(customer: CustomerRecord): Promise<void> {
    this.saveCalls += 1;
    this.customersByOwner.set(`${customer.ownerType}:${customer.ownerId}`, customer);
  }

  async findByOwner(input: { ownerType: string; ownerId: string; processor?: string }): Promise<CustomerRecord | null> {
    const customer = this.customersByOwner.get(`${input.ownerType}:${input.ownerId}`);

    if (customer === undefined) {
      return null;
    }

    if (input.processor !== undefined && input.processor !== customer.processor) {
      return null;
    }

    return customer;
  }

  async findByProcessor(input: { processor: string; processorId: string }): Promise<CustomerRecord | null> {
    for (const customer of this.customersByOwner.values()) {
      if (customer.processor === input.processor && customer.processorId === input.processorId) {
        return customer;
      }
    }

    return null;
  }
}

class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly rows = new Map<string, SubscriptionRecord>();

  async upsert(subscription: SubscriptionRecord): Promise<void> {
    this.rows.set(subscription.processorId, subscription);
  }

  async findByProcessorId(processorId: string): Promise<SubscriptionRecord | null> {
    return this.rows.get(processorId) ?? null;
  }

  async listByCustomer(customerId: string): Promise<readonly SubscriptionRecord[]> {
    return Array.from(this.rows.values()).filter((row) => row.customerId === customerId);
  }
}

class InMemoryInvoiceRepository {
  private readonly rows = new Map<string, InvoiceProjectionRecord>();

  async upsert(invoice: InvoiceProjectionRecord): Promise<void> {
    this.rows.set(invoice.processorId, invoice);
  }

  async findByProcessorId(processorId: string): Promise<InvoiceProjectionRecord | null> {
    return this.rows.get(processorId) ?? null;
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function makeEvent(input: { id: string; type: string; object: Record<string, unknown>; account?: string }): Stripe.Event {
  return {
    id: input.id,
    object: "event",
    type: input.type,
    account: input.account,
    data: {
      object: input.object,
    },
  } as unknown as Stripe.Event;
}

const customers = new Map<string, Stripe.Customer>();
const subscriptions = new Map<string, Stripe.Subscription>();
const invoices = new Map<string, Stripe.Invoice>();
const customerRetrieveStripeAccounts: Array<string | undefined> = [];

const stripe = {
  customers: {
    create: async (input: Stripe.CustomerCreateParams) => {
      const customer = {
        id: `cus_${customers.size + 1}`,
        object: "customer",
        email: input.email ?? null,
        metadata: input.metadata ?? {},
        invoice_settings: {},
      } as Stripe.Customer;
      customers.set(customer.id, customer);
      return customer;
    },
    retrieve: async (customerId: string, requestOptions?: Stripe.RequestOptions) => {
      customerRetrieveStripeAccounts.push(requestOptions?.stripeAccount);
      const customer = customers.get(customerId);

      if (customer === undefined) {
        throw new Error(`Missing customer fixture ${customerId}`);
      }

      return customer;
    },
  },
  subscriptions: {
    retrieve: async (subscriptionId: string) => {
      const subscription = subscriptions.get(subscriptionId);

      if (subscription === undefined) {
        throw new Error(`Missing subscription fixture ${subscriptionId}`);
      }

      return subscription;
    },
  },
  invoices: {
    retrieve: async (invoiceId: string) => {
      const invoice = invoices.get(invoiceId);

      if (invoice === undefined) {
        throw new Error(`Missing invoice fixture ${invoiceId}`);
      }

      return invoice;
    },
  },
  paymentIntents: {
    create: async () => {
      throw {
        code: "authentication_required",
        message: "Payment requires additional authentication.",
        payment_intent: {
          id: "pi_requires_action",
          status: "requires_action",
          client_secret: "pi_secret_123",
        },
      };
    },
  },
} as unknown as Stripe;

const customerProjectionRepository = new InMemoryCustomerProjectionRepository();
const ownerCustomerRepository = new InMemoryOwnerCustomerRepository();
const subscriptionRepository = new InMemorySubscriptionRepository();
const invoiceRepository = new InMemoryInvoiceRepository();
const customerRegistry = createCustomerRegistry();

registerCustomerModel(customerRegistry, {
  modelName: "User",
  resolveOwner: (record: { id: string }) => record,
  isDefault: true,
});

const facade = createSolidusFacade({
  stripe,
  repositories: {
    customers: customerProjectionRepository,
    subscriptions: subscriptionRepository,
  },
  ownerCustomers: ownerCustomerRepository,
  webhookRepositories: {
    invoices: invoiceRepository,
  },
  customerRegistry,
  webhookRegistration: {
    enableDefaultEffects: true,
  },
});

const idempotencyRepository = new InMemoryIdempotencyRepository();
const eventRepository = new InMemoryWebhookRepository();
const outbox = new InMemoryOutbox();
const logs: Array<{ event: string; status?: string }> = [];
const metrics: Array<{ name: string; value: number }> = [];

const queue = createDbOutboxQueueAdapter({ outbox });

const pipeline = createPersistFirstWebhookPipeline({
  idempotencyRepository,
  eventRepository,
  queue,
  observability: {
    log(entry) {
      logs.push({ event: entry.event, status: entry.status });
    },
    metric(sample) {
      metrics.push({ name: sample.name, value: sample.value });
    },
  },
  processEvent: async (event) => {
    await facade.webhooks.process(event.payload as Stripe.Event);
  },
});

const assignment = await facade.convenience.setOwnerStripeProcessor({
  ownerType: "User",
  ownerId: "42",
  customer: {
    email: "smoke@example.com",
  },
});

assert(assignment.customerId.startsWith("cus_"), "Processor assignment should create or resolve a Stripe customer.");
assert(ownerCustomerRepository.saveCalls === 1, "Processor assignment should persist owner-to-customer linkage.");

const customerUpdatedResult = await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_customer_updated",
  eventType: "customer.updated",
  payload: makeEvent({
    id: "evt_customer_updated",
    type: "customer.updated",
    account: "acct_smoke",
    object: {
      id: assignment.customerId,
    },
  }),
});
assert(customerUpdatedResult.status === "queued", "Customer updated webhook should queue for processing.");
await drainDbOutboxQueue({ outbox, pipeline });

const syncedCustomer = await facade.convenience.syncCustomer({
  ownerType: "User",
  ownerId: "42",
});
assert(syncedCustomer?.id === assignment.customerId, "syncCustomer should reconcile the owner customer.");
assert(
  customerRetrieveStripeAccounts.at(-1) === "acct_smoke",
  "Connected account context should be used when reconciling owner customers.",
);

const checkoutIngest = await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_checkout_link",
  eventType: "checkout.session.completed",
  payload: makeEvent({
    id: "evt_checkout_link",
    type: "checkout.session.completed",
    object: {
      id: "cs_1",
      client_reference_id: "User:42",
      customer: assignment.customerId,
    },
  }),
});
assert(checkoutIngest.status === "queued", "Checkout owner-linking webhook should queue.");
await drainDbOutboxQueue({ outbox, pipeline });

const replayIngest = await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_checkout_link",
  eventType: "checkout.session.completed",
  payload: makeEvent({
    id: "evt_checkout_link",
    type: "checkout.session.completed",
    object: {
      id: "cs_1",
      client_reference_id: "User:42",
      customer: assignment.customerId,
    },
  }),
});
assert(replayIngest.status === "duplicate", "Webhook replay should report duplicate status.");
assert(ownerCustomerRepository.saveCalls === 1, "Checkout owner-linking replay should stay idempotent.");

invoices.set("in_1", {
  id: "in_1",
  object: "invoice",
  customer: assignment.customerId,
  status: "open",
  amount_due: 1200,
  amount_paid: 0,
  currency: "usd",
  due_date: 1_800_000_000,
  status_transitions: {
    paid_at: null,
  },
} as unknown as Stripe.Invoice);

const actionRequiredResult = await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_invoice_action_required",
  eventType: "invoice.payment_action_required",
  payload: makeEvent({
    id: "evt_invoice_action_required",
    type: "invoice.payment_action_required",
    object: {
      id: "in_1",
      payment_intent: "pi_requires_action",
      customer: assignment.customerId,
    },
  }),
});
assert(actionRequiredResult.status === "queued", "Action-required invoice webhook should queue.");
await drainDbOutboxQueue({ outbox, pipeline });

const actionRequiredProjection = await invoiceRepository.findByProcessorId("in_1");
assert(actionRequiredProjection?.status === "open", "Invoice action-required webhook should persist invoice projection state.");

subscriptions.set("sub_1", {
  id: "sub_1",
  object: "subscription",
  customer: assignment.customerId,
  status: "trialing",
  cancel_at_period_end: false,
  current_period_start: 1_700_000_000,
  current_period_end: 1_900_000_000,
  trial_end: 1_800_000_000,
  pause_collection: null,
  items: {
    object: "list",
    data: [{ id: "si_1", object: "subscription_item", quantity: 1, price: { id: "price_basic" } }],
  },
} as unknown as Stripe.Subscription);

await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_subscription_created",
  eventType: "customer.subscription.created",
  payload: makeEvent({
    id: "evt_subscription_created",
    type: "customer.subscription.created",
    object: { id: "sub_1" },
  }),
});
await drainDbOutboxQueue({ outbox, pipeline });

const trialSubscription = await subscriptionRepository.findByProcessorId("sub_1");
assert(trialSubscription?.status === "trialing", "Subscription create lifecycle should persist trialing status.");
assert(facade.api.state.onTrial(trialSubscription!, new Date(1_750_000_000_000)), "Trial lifecycle state should be true.");

subscriptions.set("sub_1", {
  ...(subscriptions.get("sub_1") as Stripe.Subscription),
  status: "active",
  cancel_at_period_end: true,
} as Stripe.Subscription);

await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_subscription_updated",
  eventType: "customer.subscription.updated",
  payload: makeEvent({
    id: "evt_subscription_updated",
    type: "customer.subscription.updated",
    object: { id: "sub_1" },
  }),
});
await drainDbOutboxQueue({ outbox, pipeline });

const activeSubscription = await subscriptionRepository.findByProcessorId("sub_1");
assert(activeSubscription?.status === "active", "Subscription update lifecycle should persist active status.");
assert(facade.api.state.onGracePeriod(activeSubscription!, new Date(1_750_000_000_000)), "Grace period state should be true.");

subscriptions.set("sub_1", {
  ...(subscriptions.get("sub_1") as Stripe.Subscription),
  status: "canceled",
  cancel_at_period_end: false,
} as Stripe.Subscription);

await pipeline.ingest({
  processor: "stripe",
  eventId: "evt_subscription_deleted",
  eventType: "customer.subscription.deleted",
  payload: makeEvent({
    id: "evt_subscription_deleted",
    type: "customer.subscription.deleted",
    object: { id: "sub_1" },
  }),
});
await drainDbOutboxQueue({ outbox, pipeline });

const canceledSubscription = await subscriptionRepository.findByProcessorId("sub_1");
assert(canceledSubscription?.status === "canceled", "Subscription delete lifecycle should persist canceled status.");
assert(!facade.api.state.subscribed(canceledSubscription!), "Canceled subscription should not be considered subscribed.");

let actionRequiredCaught = false;
try {
  await facade.api.charges.charge({
    customerId: assignment.customerId,
    amount: 2500,
    currency: "usd",
    paymentMethodId: "pm_requires_action",
  });
} catch (error: unknown) {
  actionRequiredCaught = error instanceof ActionRequiredError;
}

assert(actionRequiredCaught, "SCA action-required payment attempts should raise ActionRequiredError.");
assert(logs.some((entry) => entry.event === "webhook.ingest.queued"), "Observability logs should include queued checkpoints.");
assert(logs.some((entry) => entry.event === "webhook.ingest.duplicate"), "Observability logs should include replay checkpoints.");
assert(logs.some((entry) => entry.event === "webhook.process.processed"), "Observability logs should include processed checkpoints.");
assert(metrics.length > 0, "Observability metrics should capture webhook checkpoint samples.");

console.log("Example app parity smoke checks passed.");
