export interface CustomerRecord {
  id: string;
  ownerType: string;
  ownerId: string;
  processor: string;
  processorId: string;
  metadata?: Record<string, string>;
}

export interface CustomerRepository {
  save(customer: CustomerRecord): Promise<void>;
  findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
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
