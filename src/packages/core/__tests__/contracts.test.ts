import { describe, expect, test } from "bun:test";
import type {
  CustomerRecord,
  CustomerRepository,
  DomainEvent,
  EventBus,
  IdempotencyRepository,
  QueueJob,
  QueueAdapter,
  SolidusRepositories,
} from "../contracts.ts";

class FakeCustomerRepository implements CustomerRepository {
  private readonly customers: CustomerRecord[] = [];

  async save(customer: CustomerRecord): Promise<void> {
    this.customers.push(customer);
  }

  async findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null> {
    return (
      this.customers.find(
        (customer) =>
          customer.ownerType === input.ownerType &&
          customer.ownerId === input.ownerId &&
          (input.processor === undefined || customer.processor === input.processor),
      ) ?? null
    );
  }
}

class FakeIdempotencyRepository implements IdempotencyRepository {
  private readonly reservations = new Set<string>();

  async reserve(input: { key: string; scope: string }): Promise<"created" | "exists"> {
    const reservationKey = `${input.scope}:${input.key}`;

    if (this.reservations.has(reservationKey)) {
      return "exists";
    }

    this.reservations.add(reservationKey);
    return "created";
  }

  async release(input: { key: string; scope: string }): Promise<void> {
    this.reservations.delete(`${input.scope}:${input.key}`);
  }
}

class FakeEventBus implements EventBus {
  readonly events: DomainEvent[] = [];

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    this.events.push(event as DomainEvent);
  }
}

class FakeQueueAdapter implements QueueAdapter {
  readonly jobs: QueueJob[] = [];

  async enqueue(job: QueueJob): Promise<{ jobId: string }> {
    this.jobs.push(job);
    return { jobId: `job_${this.jobs.length}` };
  }
}

describe("core contracts", () => {
  test("customer and idempotency repositories work with fake adapters", async () => {
    const repositories: SolidusRepositories = {
      customers: new FakeCustomerRepository(),
      idempotency: new FakeIdempotencyRepository(),
    };

    const reservationOne = await repositories.idempotency.reserve({
      key: "evt_123",
      scope: "webhook",
    });
    const reservationTwo = await repositories.idempotency.reserve({
      key: "evt_123",
      scope: "webhook",
    });

    await repositories.customers.save({
      id: "cus_local_1",
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
      processorId: "cus_123",
    });

    const customer = await repositories.customers.findByOwner({
      ownerType: "User",
      ownerId: "42",
      processor: "stripe",
    });

    expect(reservationOne).toBe("created");
    expect(reservationTwo).toBe("exists");
    expect(customer?.processorId).toBe("cus_123");
  });

  test("event bus and queue adapters can coordinate background work", async () => {
    const eventBus = new FakeEventBus();
    const queue = new FakeQueueAdapter();

    await eventBus.publish({
      name: "customer.registered",
      payload: { ownerId: "42" },
      occurredAt: new Date(),
    });

    const queuedJob = await queue.enqueue({
      name: "sync.analytics",
      payload: { ownerId: "42" },
      idempotencyKey: "sync:42",
    });

    expect(eventBus.events.map((event) => event.name)).toEqual(["customer.registered"]);
    expect(queue.jobs.map((job) => job.name)).toEqual(["sync.analytics"]);
    expect(queuedJob.jobId).toBe("job_1");
  });
});
