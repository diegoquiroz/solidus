export interface CustomerRecord {
  id: string;
  ownerType: string;
  ownerId: string;
  processor: string;
  processorId: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface CustomerRepository {
  save(customer: CustomerRecord): Promise<void>;
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

export interface IdempotencyRepository {
  reserve(input: { key: string; scope: string }): Promise<"created" | "exists">;
  release(input: { key: string; scope: string }): Promise<void>;
}

export interface SolidusRepositories {
  customers: CustomerRepository;
  idempotency: IdempotencyRepository;
}

export interface QueueJob {
  name: string;
  payload: unknown;
  idempotencyKey?: string;
  runAt?: Date;
}

export interface QueueAdapter {
  enqueue(job: QueueJob): Promise<{ jobId: string }>;
}

export interface DomainEvent<TPayload = unknown> {
  name: string;
  payload: TPayload;
  occurredAt: Date;
}

export interface PaymentMethodRecord {
  id: string;
  processor: string;
  processorId: string;
  customerProcessorId: string;
  methodType: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  rawPayload: unknown;
}

export interface PaymentMethodRepository {
  upsert(paymentMethod: PaymentMethodRecord): Promise<void>;
  clearDefaultForCustomer(customerProcessorId: string): Promise<void>;
  deleteByProcessorId(processorId: string): Promise<void>;
  findByProcessorId(processorId: string): Promise<PaymentMethodRecord | null>;
  listByCustomer(customerProcessorId: string): Promise<readonly PaymentMethodRecord[]>;
}

export interface ChargeRecord {
  id: string;
  processor: string;
  processorId: string;
  customerProcessorId: string;
  amount: number;
  currency: string;
  status: string;
  receiptUrl?: string;
  taxAmount?: number;
  totalTaxAmounts?: unknown;
  refundTotal?: number;
  paymentMethodSnapshot?: unknown;
  rawPayload: unknown;
}

export interface ChargeRepository {
  upsert(charge: ChargeRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<ChargeRecord | null>;
}

export interface SubscriptionRecord {
  id: string;
  processor: string;
  processorId: string;
  customerProcessorId: string;
  status: string;
  priceId?: string;
  quantity?: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  pausedBehavior?: "void" | "keep_as_draft" | "mark_uncollectible";
  pausedResumesAt?: Date;
  rawPayload: unknown;
}

export interface SubscriptionRepository {
  upsert(subscription: SubscriptionRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<SubscriptionRecord | null>;
  listByCustomer(customerProcessorId: string): Promise<readonly SubscriptionRecord[]>;
}

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}

export interface CustomerModelDefinition<TRecord = unknown, TOwner = unknown> {
  modelName: string;
  resolveOwner(record: TRecord): TOwner | null | undefined;
  getClientReferenceId?(record: TRecord): unknown;
  isDefault?: boolean;
}

export interface RegisteredCustomerModel<TRecord = unknown, TOwner = unknown>
  extends CustomerModelDefinition<TRecord, TOwner> {
  readonly isDefault: boolean;
}

export interface CustomerRegistry {
  register<TRecord, TOwner>(
    definition: CustomerModelDefinition<TRecord, TOwner>,
  ): RegisteredCustomerModel<TRecord, TOwner>;
  get(modelName: string): RegisteredCustomerModel | undefined;
  getDefault(): RegisteredCustomerModel | undefined;
  list(): readonly RegisteredCustomerModel[];
}
