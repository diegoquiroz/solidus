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
  StripeAccountProjection,
  StripeAccountProjectionRepository,
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
  findByProcessor(input: {
    processor: string;
    processorId: string;
  }): Promise<CustomerRecord | null>;
}

export interface SequelizeIdempotencyDelegate {
  reserve(input: { key: string; scope: string }): Promise<"created" | "exists">;
  release(input: { key: string; scope: string }): Promise<void>;
}

export interface SequelizeStripeCustomerProjectionDelegate {
  upsert(customer: StripeCustomerProjection): Promise<void>;
  findByProcessorId(processorId: string): Promise<StripeCustomerProjection | null>;
}

export interface SequelizeStripeAccountProjectionDelegate {
  upsert(account: StripeAccountProjection): Promise<void>;
  findByProcessorId?(processorId: string): Promise<StripeAccountProjection | null>;
}

export interface SequelizePaymentMethodDelegate {
  upsert(paymentMethod: PaymentMethodRecord): Promise<void>;
  clearDefaultForCustomer(customerProcessorId: string): Promise<void>;
  deleteByProcessorId(processorId: string): Promise<void>;
  findByProcessorId(processorId: string): Promise<PaymentMethodRecord | null>;
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

interface SequelizeModelResultLike {
  get?(input?: { plain?: boolean }): unknown;
  [key: string]: unknown;
}

interface SequelizeModelLike {
  upsert?(values: Record<string, unknown>): Promise<unknown>;
  create?(values: Record<string, unknown>): Promise<unknown>;
  findOne?(input: { where: Record<string, unknown> }): Promise<unknown | null>;
  findAll?(input: { where: Record<string, unknown> }): Promise<readonly unknown[]>;
  update?(values: Record<string, unknown>, input: { where: Record<string, unknown> }): Promise<unknown>;
  destroy?(input: { where: Record<string, unknown> }): Promise<unknown>;
}

export interface SequelizeReferenceModels {
  customers: SequelizeModelLike;
  idempotency?: SequelizeModelLike;
  stripeCustomers: SequelizeModelLike;
  stripeAccounts?: SequelizeModelLike;
  paymentMethods: SequelizeModelLike;
  charges: SequelizeModelLike;
  subscriptions: SequelizeModelLike;
  invoices: SequelizeModelLike;
  webhookEvents: SequelizeModelLike;
  outbox: SequelizeModelLike;
}

function asPlainRecord<T>(value: unknown): T {
  if (typeof value === "object" && value !== null && typeof (value as SequelizeModelResultLike).get === "function") {
    return (value as SequelizeModelResultLike).get!({ plain: true }) as T;
  }

  return value as T;
}

function requireModelMethod<T extends (...args: never[]) => unknown>(
  model: SequelizeModelLike,
  method: keyof SequelizeModelLike,
): T {
  const candidate = model[method];

  if (typeof candidate !== "function") {
    throw new Error(`Sequelize model is missing required method ${String(method)}.`);
  }

  return candidate.bind(model) as T;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as {
    name?: string;
    code?: string | number;
    original?: { code?: string | number };
    parent?: { code?: string | number };
  };

  if (typeof candidate.name === "string" && candidate.name.includes("UniqueConstraint")) {
    return true;
  }

  const code = candidate.code ?? candidate.original?.code ?? candidate.parent?.code;
  return code === "23505" || code === "SQLITE_CONSTRAINT" || code === 19;
}

function ensureJobId(value: unknown): string {
  const row = asPlainRecord<Record<string, unknown>>(value);
  const id = row.id;

  if (typeof id === "string" && id.length > 0) {
    return id;
  }

  throw new Error("Outbox create must return a row with a string id field.");
}

export function createSequelizeDelegatesFromModels(models: SequelizeReferenceModels): SequelizeRepositoryDelegates {
  const inMemoryIdempotency = new Set<string>();

  return {
    customers: {
      async upsert(customer) {
        await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.customers,
          "upsert",
        )(customer as unknown as Record<string, unknown>);
      },
      async findByOwner(input) {
        const where: Record<string, unknown> = {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
        };

        if (input.processor !== undefined) {
          where.processor = input.processor;
        }

        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.customers, "findOne")({ where });

        return row === null ? null : asPlainRecord<CustomerRecord>(row);
      },
      async findByProcessor(input) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.customers, "findOne")({
          where: {
            processor: input.processor,
            processorId: input.processorId,
          },
        });

        return row === null ? null : asPlainRecord<CustomerRecord>(row);
      },
    },
    idempotency: models.idempotency === undefined
      ? {
          async reserve(input) {
            const key = `${input.scope}:${input.key}`;

            if (inMemoryIdempotency.has(key)) {
              return "exists";
            }

            inMemoryIdempotency.add(key);
            return "created";
          },
          async release(input) {
            inMemoryIdempotency.delete(`${input.scope}:${input.key}`);
          },
        }
      : {
          async reserve(input) {
            try {
              await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
                models.idempotency!,
                "create",
              )({
                key: input.key,
                scope: input.scope,
              });

              return "created";
            } catch (error: unknown) {
              if (isUniqueConstraintError(error)) {
                return "exists";
              }

              throw error;
            }
          },
          async release(input) {
            await requireModelMethod<
              (input: { where: Record<string, unknown> }) => Promise<unknown>
            >(models.idempotency!, "destroy")({
              where: {
                key: input.key,
                scope: input.scope,
              },
            });
          },
        },
    stripeCustomers: {
      async upsert(customer) {
        await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.stripeCustomers,
          "upsert",
        )(customer as unknown as Record<string, unknown>);
      },
      async findByProcessorId(processorId) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.stripeCustomers, "findOne")({
          where: {
            processorId,
          },
        });

        return row === null ? null : asPlainRecord<StripeCustomerProjection>(row);
      },
    },
    stripeAccounts: models.stripeAccounts === undefined
      ? undefined
      : {
          async upsert(account) {
            await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
              models.stripeAccounts!,
              "upsert",
            )(account as unknown as Record<string, unknown>);
          },
          async findByProcessorId(processorId) {
            const row = await requireModelMethod<
              (input: { where: Record<string, unknown> }) => Promise<unknown | null>
            >(models.stripeAccounts!, "findOne")({
              where: {
                processorId,
              },
            });

            return row === null ? null : asPlainRecord<StripeAccountProjection>(row);
          },
        },
    paymentMethods: {
      async upsert(paymentMethod) {
        await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.paymentMethods,
          "upsert",
        )(paymentMethod as unknown as Record<string, unknown>);
      },
      async clearDefaultForCustomer(customerId) {
        await requireModelMethod<
          (values: Record<string, unknown>, input: { where: Record<string, unknown> }) => Promise<unknown>
        >(models.paymentMethods, "update")({
          default: false,
        }, {
          where: {
            customer_id: customerId,
          },
        });
      },
      async deleteByProcessorId(processorId) {
        await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown>
        >(models.paymentMethods, "destroy")({
          where: {
            processorId,
          },
        });
      },
      async findByProcessorId(processorId) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.paymentMethods, "findOne")({
          where: {
            processorId,
          },
        });

        return row === null ? null : asPlainRecord<PaymentMethodRecord>(row);
      },
      async listByCustomer(customerId) {
        const rows = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<readonly unknown[]>
        >(models.paymentMethods, "findAll")({
          where: {
            customer_id: customerId,
          },
        });

        return rows.map((row) => asPlainRecord<PaymentMethodRecord>(row));
      },
    },
    charges: {
      async upsert(charge) {
        await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.charges,
          "upsert",
        )(charge as unknown as Record<string, unknown>);
      },
      async findByProcessorId(processorId) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.charges, "findOne")({
          where: {
            processorId,
          },
        });

        return row === null ? null : asPlainRecord<ChargeRecord>(row);
      },
    },
    subscriptions: {
      async upsert(subscription) {
        await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.subscriptions,
          "upsert",
        )(subscription as unknown as Record<string, unknown>);
      },
      async findByProcessorId(processorId) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.subscriptions, "findOne")({
          where: {
            processorId,
          },
        });

        return row === null ? null : asPlainRecord<SubscriptionRecord>(row);
      },
      async listByCustomer(customerId) {
        const rows = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<readonly unknown[]>
        >(models.subscriptions, "findAll")({
          where: {
            customer_id: customerId,
          },
        });

        return rows.map((row) => asPlainRecord<SubscriptionRecord>(row));
      },
    },
    invoices: {
      async upsert(invoice) {
        await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.invoices,
          "upsert",
        )(invoice as unknown as Record<string, unknown>);
      },
      async findByProcessorId(processorId) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.invoices, "findOne")({
          where: {
            processorId,
          },
        });

        return row === null ? null : asPlainRecord<InvoiceProjectionRecord>(row);
      },
      async listByCustomer(customerProcessorId) {
        const rows = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<readonly unknown[]>
        >(models.invoices, "findAll")({
          where: {
            customerProcessorId,
          },
        });

        return rows.map((row) => asPlainRecord<InvoiceProjectionRecord>(row));
      },
    },
    webhookEvents: {
      async persist(event) {
        try {
          await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
            models.webhookEvents,
            "create",
          )({
            processor: event.processor,
            eventId: event.eventId,
            eventType: event.eventType,
            payload: event.payload,
            receivedAt: event.receivedAt,
            attemptCount: 0,
          });

          return "created";
        } catch (error: unknown) {
          if (isUniqueConstraintError(error)) {
            return "exists";
          }

          throw error;
        }
      },
      async findByEventId(input) {
        const row = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown | null>
        >(models.webhookEvents, "findOne")({
          where: {
            processor: input.processor,
            eventId: input.eventId,
          },
        });

        return row === null ? null : asPlainRecord<PersistedWebhookEvent>(row);
      },
      async markProcessed(input) {
        await requireModelMethod<
          (values: Record<string, unknown>, input: { where: Record<string, unknown> }) => Promise<unknown>
        >(models.webhookEvents, "update")({
          processedAt: input.processedAt,
        }, {
          where: {
            processor: input.processor,
            eventId: input.eventId,
          },
        });
      },
      async markRetrying(input) {
        await requireModelMethod<
          (values: Record<string, unknown>, input: { where: Record<string, unknown> }) => Promise<unknown>
        >(models.webhookEvents, "update")({
          attemptCount: input.attemptCount,
          nextAttemptAt: input.nextAttemptAt,
          lastError: input.lastError,
        }, {
          where: {
            processor: input.processor,
            eventId: input.eventId,
          },
        });
      },
      async markDeadLetter(input) {
        await requireModelMethod<
          (values: Record<string, unknown>, input: { where: Record<string, unknown> }) => Promise<unknown>
        >(models.webhookEvents, "update")({
          attemptCount: input.attemptCount,
          deadLetteredAt: input.deadLetteredAt,
          lastError: input.lastError,
        }, {
          where: {
            processor: input.processor,
            eventId: input.eventId,
          },
        });
      },
    },
    outbox: {
      async enqueue(input) {
        const created = await requireModelMethod<(values: Record<string, unknown>) => Promise<unknown>>(
          models.outbox,
          "create",
        )({
          job: input.job,
          runAt: input.runAt,
        });

        return {
          jobId: ensureJobId(created),
        };
      },
      async claimReady(input) {
        const rows = await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<readonly unknown[]>
        >(models.outbox, "findAll")({ where: {} });

        const records = rows.map((row) => asPlainRecord<DbOutboxQueueRecord>(row));
        return records.filter((row) => row.runAt.getTime() <= input.now.getTime()).slice(0, input.limit);
      },
      async acknowledge(jobId) {
        await requireModelMethod<
          (input: { where: Record<string, unknown> }) => Promise<unknown>
        >(models.outbox, "destroy")({
          where: {
            id: jobId,
          },
        });
      },
    },
  };
}

export function createSequelizeRepositoryBundleFromModels(models: SequelizeReferenceModels): SequelizeRepositoryBundle {
  return createSequelizeRepositoryBundle(createSequelizeDelegatesFromModels(models));
}

export class SequelizeCustomerRepository implements CustomerRepository {
  private readonly delegate: SequelizeCustomerDelegate;

  constructor(delegate: SequelizeCustomerDelegate) {
    this.delegate = delegate;
  }

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

  async findByProcessor(input: {
    processor: string;
    processorId: string;
  }): Promise<CustomerRecord | null> {
    return this.delegate.findByProcessor(input);
  }
}

export class SequelizeIdempotencyRepository implements IdempotencyRepository {
  private readonly delegate: SequelizeIdempotencyDelegate;

  constructor(delegate: SequelizeIdempotencyDelegate) {
    this.delegate = delegate;
  }

  async reserve(input: { key: string; scope: string }): Promise<"created" | "exists"> {
    return this.delegate.reserve(input);
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    await this.delegate.release(input);
  }
}

export class SequelizeStripeCustomerProjectionRepository implements StripeCustomerProjectionRepository {
  private readonly delegate: SequelizeStripeCustomerProjectionDelegate;

  constructor(delegate: SequelizeStripeCustomerProjectionDelegate) {
    this.delegate = delegate;
  }

  async upsert(customer: StripeCustomerProjection): Promise<void> {
    await this.delegate.upsert(customer);
  }

  async findByProcessorId(processorId: string): Promise<StripeCustomerProjection | null> {
    return this.delegate.findByProcessorId(processorId);
  }
}

export class SequelizeStripeAccountProjectionRepository implements StripeAccountProjectionRepository {
  private readonly delegate: SequelizeStripeAccountProjectionDelegate;

  constructor(delegate: SequelizeStripeAccountProjectionDelegate) {
    this.delegate = delegate;
  }

  async upsert(account: StripeAccountProjection): Promise<void> {
    await this.delegate.upsert(account);
  }

  async findByProcessorId(processorId: string): Promise<StripeAccountProjection | null> {
    return this.delegate.findByProcessorId?.(processorId) ?? null;
  }
}

export class SequelizePaymentMethodRepository implements PaymentMethodRepository {
  private readonly delegate: SequelizePaymentMethodDelegate;

  constructor(delegate: SequelizePaymentMethodDelegate) {
    this.delegate = delegate;
  }

  async upsert(paymentMethod: PaymentMethodRecord): Promise<void> {
    await this.delegate.upsert(paymentMethod);
  }

  async clearDefaultForCustomer(customerProcessorId: string): Promise<void> {
    await this.delegate.clearDefaultForCustomer(customerProcessorId);
  }

  async deleteByProcessorId(processorId: string): Promise<void> {
    await this.delegate.deleteByProcessorId(processorId);
  }

  async findByProcessorId(processorId: string): Promise<PaymentMethodRecord | null> {
    return this.delegate.findByProcessorId(processorId);
  }

  async listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]> {
    return this.delegate.listByCustomer(customerProcessorId);
  }
}

export class SequelizeChargeRepository implements ChargeRepository {
  private readonly delegate: SequelizeChargeDelegate;

  constructor(delegate: SequelizeChargeDelegate) {
    this.delegate = delegate;
  }

  async upsert(charge: ChargeRecord): Promise<void> {
    await this.delegate.upsert(charge);
  }

  async findByProcessorId(processorId: string): Promise<ChargeRecord | null> {
    return this.delegate.findByProcessorId(processorId);
  }
}

export class SequelizeSubscriptionRepository implements SubscriptionRepository {
  private readonly delegate: SequelizeSubscriptionDelegate;

  constructor(delegate: SequelizeSubscriptionDelegate) {
    this.delegate = delegate;
  }

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
  private readonly delegate: SequelizeInvoiceProjectionDelegate;

  constructor(delegate: SequelizeInvoiceProjectionDelegate) {
    this.delegate = delegate;
  }

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
  private readonly delegate: SequelizeWebhookEventDelegate;

  constructor(delegate: SequelizeWebhookEventDelegate) {
    this.delegate = delegate;
  }

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
  private readonly delegate: SequelizeDbOutboxDelegate;

  constructor(delegate: SequelizeDbOutboxDelegate) {
    this.delegate = delegate;
  }

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
  stripeAccounts?: SequelizeStripeAccountProjectionDelegate;
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
  const stripeAccounts = delegates.stripeAccounts === undefined
    ? undefined
    : new SequelizeStripeAccountProjectionRepository(delegates.stripeAccounts);
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
      accounts: stripeAccounts,
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
