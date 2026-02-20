import type {
  ChargeRecord,
  ChargeRepository,
  CustomerRecord,
  CustomerRepository,
  IdempotencyRepository,
  PaymentMethodRecord,
  PaymentMethodRepository,
  SolidusRepositories,
  SubscriptionRecord,
  SubscriptionRepository,
} from "../core/contracts.ts";
import type {
  DbOutboxQueueRecord,
  DbOutboxRepository,
  WebhookEventRepository,
  PersistedWebhookEvent,
} from "../core/webhooks.ts";
import type {
  StripeCoreRepositories,
  StripeCustomerProjection,
  StripeCustomerProjectionRepository,
} from "../stripe/core-apis.ts";

export interface InvoiceProjectionRecord {
  id: string;
  processor: string;
  processorId: string;
  customerProcessorId?: string;
  subscriptionProcessorId?: string;
  status: string;
  amountDue?: number;
  amountPaid?: number;
  currency?: string;
  dueAt?: Date;
  paidAt?: Date;
  rawPayload: unknown;
}

export interface InvoiceProjectionRepository {
  upsert(invoice: InvoiceProjectionRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<InvoiceProjectionRecord | null>;
  listByCustomer(customerProcessorId: string): Promise<readonly InvoiceProjectionRecord[]>;
}

export interface SequelizeCustomerDelegate {
  upsert(customer: CustomerRecord): Promise<void>;
  findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null>;
}

export interface SequelizeIdempotencyDelegate {
  reserve(input: { key: string; scope: string }): Promise<"created" | "exists">;
  release(input: { key: string; scope: string }): Promise<void>;
}

export interface SequelizeStripeCustomerProjectionDelegate {
  upsert(customer: StripeCustomerProjection): Promise<void>;
}

export interface SequelizePaymentMethodDelegate {
  upsert(paymentMethod: PaymentMethodRecord): Promise<void>;
  clearDefaultForCustomer(customerProcessorId: string): Promise<void>;
  deleteByProcessorId(processorId: string): Promise<void>;
  listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]>;
}

export interface SequelizeChargeDelegate {
  upsert(charge: ChargeRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<ChargeRecord | null>;
}

export interface SequelizeSubscriptionDelegate {
  upsert(subscription: SubscriptionRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<SubscriptionRecord | null>;
  listByCustomer(customerProcessorId: string): Promise<readonly SubscriptionRecord[]>;
}

export interface SequelizeInvoiceProjectionDelegate {
  upsert(invoice: InvoiceProjectionRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<InvoiceProjectionRecord | null>;
  listByCustomer(customerProcessorId: string): Promise<readonly InvoiceProjectionRecord[]>;
}

export interface SequelizeWebhookEventDelegate {
  persist(event: {
    processor: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
  }): Promise<"created" | "exists">;
  findByEventId(input: { processor: string; eventId: string }): Promise<PersistedWebhookEvent | null>;
  markProcessed(input: { processor: string; eventId: string; processedAt: Date }): Promise<void>;
  markRetrying(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    nextAttemptAt: Date;
    lastError: string;
  }): Promise<void>;
  markDeadLetter(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    deadLetteredAt: Date;
    lastError: string;
  }): Promise<void>;
}

export interface SequelizeDbOutboxDelegate {
  enqueue(input: { job: DbOutboxQueueRecord["job"]; runAt: Date }): Promise<{ jobId: string }>;
  claimReady(input: { now: Date; limit: number }): Promise<readonly DbOutboxQueueRecord[]>;
  acknowledge(jobId: string): Promise<void>;
}

export class SequelizeCustomerRepository implements CustomerRepository {
  constructor(private readonly delegate: SequelizeCustomerDelegate) {}

  async save(customer: CustomerRecord): Promise<void> {
    await this.delegate.upsert(customer);
  }

  async findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null> {
    return this.delegate.findByOwner(input);
  }
}

export class SequelizeIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly delegate: SequelizeIdempotencyDelegate) {}

  async reserve(input: { key: string; scope: string }): Promise<"created" | "exists"> {
    return this.delegate.reserve(input);
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    await this.delegate.release(input);
  }
}

export class SequelizeStripeCustomerProjectionRepository implements StripeCustomerProjectionRepository {
  constructor(private readonly delegate: SequelizeStripeCustomerProjectionDelegate) {}

  async upsert(customer: StripeCustomerProjection): Promise<void> {
    await this.delegate.upsert(customer);
  }
}

export class SequelizePaymentMethodRepository implements PaymentMethodRepository {
  constructor(private readonly delegate: SequelizePaymentMethodDelegate) {}

  async upsert(paymentMethod: PaymentMethodRecord): Promise<void> {
    await this.delegate.upsert(paymentMethod);
  }

  async clearDefaultForCustomer(customerProcessorId: string): Promise<void> {
    await this.delegate.clearDefaultForCustomer(customerProcessorId);
  }

  async deleteByProcessorId(processorId: string): Promise<void> {
    await this.delegate.deleteByProcessorId(processorId);
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]> {
    return this.delegate.listByCustomer(customerProcessorId);
  }
}

export class SequelizeChargeRepository implements ChargeRepository {
  constructor(private readonly delegate: SequelizeChargeDelegate) {}

  async upsert(charge: ChargeRecord): Promise<void> {
    await this.delegate.upsert(charge);
  }

  async findByProcessorId(processorId: string): Promise<ChargeRecord | null> {
    return this.delegate.findByProcessorId(processorId);
  }
}

export class SequelizeSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly delegate: SequelizeSubscriptionDelegate) {}

  async upsert(subscription: SubscriptionRecord): Promise<void> {
    await this.delegate.upsert(subscription);
  }

  async findByProcessorId(processorId: string): Promise<SubscriptionRecord | null> {
    return this.delegate.findByProcessorId(processorId);
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly SubscriptionRecord[]> {
    return this.delegate.listByCustomer(customerProcessorId);
  }
}

export class SequelizeInvoiceProjectionRepository implements InvoiceProjectionRepository {
  constructor(private readonly delegate: SequelizeInvoiceProjectionDelegate) {}

  async upsert(invoice: InvoiceProjectionRecord): Promise<void> {
    await this.delegate.upsert(invoice);
  }

  async findByProcessorId(processorId: string): Promise<InvoiceProjectionRecord | null> {
    return this.delegate.findByProcessorId(processorId);
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly InvoiceProjectionRecord[]> {
    return this.delegate.listByCustomer(customerProcessorId);
  }
}

export class SequelizeWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly delegate: SequelizeWebhookEventDelegate) {}

  async persist(event: {
    processor: string;
    eventId: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
  }): Promise<"created" | "exists"> {
    return this.delegate.persist(event);
  }

  async findByEventId(input: { processor: string; eventId: string }): Promise<PersistedWebhookEvent | null> {
    return this.delegate.findByEventId(input);
  }

  async markProcessed(input: { processor: string; eventId: string; processedAt: Date }): Promise<void> {
    await this.delegate.markProcessed(input);
  }

  async markRetrying(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    nextAttemptAt: Date;
    lastError: string;
  }): Promise<void> {
    await this.delegate.markRetrying(input);
  }

  async markDeadLetter(input: {
    processor: string;
    eventId: string;
    attemptCount: number;
    deadLetteredAt: Date;
    lastError: string;
  }): Promise<void> {
    await this.delegate.markDeadLetter(input);
  }
}

export class SequelizeDbOutboxRepository implements DbOutboxRepository {
  constructor(private readonly delegate: SequelizeDbOutboxDelegate) {}

  async enqueue(input: {
    job: DbOutboxQueueRecord["job"];
    runAt: Date;
  }): Promise<{ jobId: string }> {
    return this.delegate.enqueue(input);
  }

  async claimReady(input: { now: Date; limit: number }): Promise<readonly DbOutboxQueueRecord[]> {
    return this.delegate.claimReady(input);
  }

  async acknowledge(jobId: string): Promise<void> {
    await this.delegate.acknowledge(jobId);
  }
}

export interface SequelizeRepositoryDelegates {
  customers: SequelizeCustomerDelegate;
  idempotency: SequelizeIdempotencyDelegate;
  stripeCustomers: SequelizeStripeCustomerProjectionDelegate;
  paymentMethods: SequelizePaymentMethodDelegate;
  charges: SequelizeChargeDelegate;
  subscriptions: SequelizeSubscriptionDelegate;
  invoices: SequelizeInvoiceProjectionDelegate;
  webhookEvents: SequelizeWebhookEventDelegate;
  outbox: SequelizeDbOutboxDelegate;
}

export interface SequelizeRepositoryBundle {
  core: SolidusRepositories;
  facade: StripeCoreRepositories;
  webhook: {
    idempotencyRepository: IdempotencyRepository;
    eventRepository: WebhookEventRepository;
    outboxRepository: DbOutboxRepository;
  };
  invoices: InvoiceProjectionRepository;
}

export function createSequelizeRepositoryBundle(
  delegates: SequelizeRepositoryDelegates,
): SequelizeRepositoryBundle {
  const customers = new SequelizeCustomerRepository(delegates.customers);
  const idempotency = new SequelizeIdempotencyRepository(delegates.idempotency);
  const stripeCustomers = new SequelizeStripeCustomerProjectionRepository(delegates.stripeCustomers);
  const paymentMethods = new SequelizePaymentMethodRepository(delegates.paymentMethods);
  const charges = new SequelizeChargeRepository(delegates.charges);
  const subscriptions = new SequelizeSubscriptionRepository(delegates.subscriptions);
  const invoices = new SequelizeInvoiceProjectionRepository(delegates.invoices);
  const eventRepository = new SequelizeWebhookEventRepository(delegates.webhookEvents);
  const outboxRepository = new SequelizeDbOutboxRepository(delegates.outbox);

  return {
    core: {
      customers,
      idempotency,
    },
    facade: {
      customers: stripeCustomers,
      paymentMethods,
      charges,
      subscriptions,
    },
    webhook: {
      idempotencyRepository: idempotency,
      eventRepository,
      outboxRepository,
    },
    invoices,
  };
}
