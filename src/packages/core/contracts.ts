export interface CustomerRecord {
  id: string;
  ownerType: string;
  ownerId: string;
  processor: string;
  processorId: string;
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
  processorId: string;
  default?: boolean;
  data?: Record<string, unknown>;
}

export interface PaymentMethodRepository {
  upsert(paymentMethod: PaymentMethodRecord): Promise<void>;
  clearDefaultForCustomer(customerId: string): Promise<void>;
  deleteByProcessorId(processorId: string): Promise<void>;
  findByProcessorId(processorId: string): Promise<PaymentMethodRecord | null>;
  listByCustomer(customerId: string): Promise<readonly PaymentMethodRecord[]>;
}

export interface ChargeRecord {
  id: string;
  processorId: string;
  customerId: string;
  subscriptionId?: string;
  amount: number;
  currency?: string;
  applicationFeeAmount?: number;
  amountRefunded?: number;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface ChargeRepository {
  upsert(charge: ChargeRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<ChargeRecord | null>;
}

export interface SubscriptionRecord {
  id: string;
  customerId: string;
  name: string;
  processorId: string;
  processorPlan: string;
  quantity: number;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  endsAt?: Date;
  metered?: boolean;
  pauseBehavior?: string;
  pauseStartsAt?: Date;
  pauseResumesAt?: Date;
  applicationFeePercent?: number;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  paymentMethodId?: string;
}

export interface SubscriptionRepository {
  upsert(subscription: SubscriptionRecord): Promise<void>;
  findByProcessorId(processorId: string): Promise<SubscriptionRecord | null>;
  listByCustomer(customerId: string): Promise<readonly SubscriptionRecord[]>;
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
