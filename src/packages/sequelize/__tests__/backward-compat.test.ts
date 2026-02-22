import { describe, expect, test } from "bun:test";
import {
  createSequelizeRepositoryBundleFromModels,
  createSequelizeDelegatesFromModels,
  SequelizeCustomerRepository,
} from "../repositories.ts";
import {
  createBillingMixin,
  solidusBillingMixin,
} from "../../core/model-extension.ts";
import { Solidus, configure, getGlobalFacade } from "../../core/global-facade.ts";

class InMemorySequelizeModel {
  private readonly rows: Array<Record<string, unknown>> = [];
  private sequence = 0;

  constructor(
    private readonly uniqueConstraints: readonly (readonly string[])[] = [],
  ) {}

  async upsert(values: Record<string, unknown>): Promise<void> {
    const index = this.findUniqueMatch(values);

    if (index >= 0) {
      this.rows[index] = {
        ...this.rows[index],
        ...values,
      };
      return;
    }

    this.rows.push({ ...values });
  }

  async create(values: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.findUniqueMatch(values) >= 0) {
      const error = new Error("unique constraint") as Error & { name: string; code: string };
      error.name = "SequelizeUniqueConstraintError";
      error.code = "23505";
      throw error;
    }

    const row = {
      id: typeof values.id === "string" ? values.id : `row_${++this.sequence}`,
      ...values,
    };

    this.rows.push(row);
    return { ...row };
  }

  async findOne(input: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
    const match = this.rows.find((row) => this.matchesWhere(row, input.where));
    return match === undefined ? null : { ...match };
  }

  async findAll(input: { where: Record<string, unknown> }): Promise<readonly Record<string, unknown>[]> {
    return this.rows.filter((row) => this.matchesWhere(row, input.where)).map((row) => ({ ...row }));
  }

  async update(values: Record<string, unknown>, input: { where: Record<string, unknown> }): Promise<void> {
    for (let index = 0; index < this.rows.length; index += 1) {
      if (this.matchesWhere(this.rows[index]!, input.where)) {
        this.rows[index] = {
          ...this.rows[index],
          ...values,
        };
      }
    }
  }

  async destroy(input: { where: Record<string, unknown> }): Promise<void> {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.matchesWhere(this.rows[index]!, input.where)) {
        this.rows.splice(index, 1);
      }
    }
  }

  private findUniqueMatch(values: Record<string, unknown>): number {
    for (const fields of this.uniqueConstraints) {
      const index = this.rows.findIndex((row) => fields.every((field) => row[field] === values[field]));

      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  private matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    for (const [field, value] of Object.entries(where)) {
      if (row[field] !== value) {
        return false;
      }
    }

    return true;
  }
}

describe("backward compatibility", () => {
  test("createSequelizeRepositoryBundleFromModels still exists and works", async () => {
    const bundle = createSequelizeRepositoryBundleFromModels({
      customers: new InMemorySequelizeModel([["processor", "processorId"]]),
      idempotency: new InMemorySequelizeModel([["scope", "key"]]),
      stripeCustomers: new InMemorySequelizeModel([["processorId"]]),
      stripeAccounts: new InMemorySequelizeModel([["processorId"]]),
      paymentMethods: new InMemorySequelizeModel([["processorId"]]),
      charges: new InMemorySequelizeModel([["processorId"]]),
      subscriptions: new InMemorySequelizeModel([["processorId"]]),
      invoices: new InMemorySequelizeModel([["processorId"]]),
      webhookEvents: new InMemorySequelizeModel([["processor", "eventId"]]),
      outbox: new InMemorySequelizeModel(),
    });

    expect(bundle).toBeDefined();
    expect(bundle.core.customers).toBeInstanceOf(SequelizeCustomerRepository);
  });

  test("createSequelizeDelegatesFromModels still exists and works", async () => {
    const delegates = createSequelizeDelegatesFromModels({
      customers: new InMemorySequelizeModel([["processor", "processorId"]]),
      stripeCustomers: new InMemorySequelizeModel([["processorId"]]),
      paymentMethods: new InMemorySequelizeModel([["processorId"]]),
      charges: new InMemorySequelizeModel([["processorId"]]),
      subscriptions: new InMemorySequelizeModel([["processorId"]]),
      invoices: new InMemorySequelizeModel([["processorId"]]),
      webhookEvents: new InMemorySequelizeModel([["processor", "eventId"]]),
      outbox: new InMemorySequelizeModel(),
    });

    expect(delegates).toBeDefined();
    expect(delegates.customers).toBeDefined();
  });

  test("createBillingMixin and solidusBillingMixin still exist", () => {
    expect(createBillingMixin).toBeDefined();
    expect(solidusBillingMixin).toBeDefined();
  });

  test("Solidus global facade methods still exist", () => {
    expect(Solidus.configure).toBeDefined();
    expect(Solidus.getFacade).toBeDefined();
    expect(configure).toBeDefined();
    expect(getGlobalFacade).toBeDefined();
  });
});
