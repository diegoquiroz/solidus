import type { CustomerRecord, CustomerRepository } from "../../core/contracts.ts";
import type { SolidusCustomer } from "../models/SolidusCustomer.ts";

export class SolidusCustomerRepository implements CustomerRepository {
  constructor(private model: typeof SolidusCustomer) {}

  async save(customer: CustomerRecord): Promise<void> {
    await this.model.upsert({
      id: customer.id,
      ownerType: customer.ownerType,
      ownerId: customer.ownerId,
      processor: customer.processor,
      processorId: customer.processorId,
      email: customer.email,
      metadata: customer.metadata ?? {},
    });
  }

  async findByOwner(input: {
    ownerType: string;
    ownerId: string;
    processor?: string;
  }): Promise<CustomerRecord | null> {
    const where: Record<string, unknown> = {
      owner_type: input.ownerType,
      owner_id: input.ownerId,
    };

    if (input.processor !== undefined) {
      where.processor = input.processor;
    }

    const row = await this.model.findOne({ where });
    
    if (row === null) {
      return null;
    }

    return {
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      processor: row.processor,
      processorId: row.processorId,
      email: row.email ?? undefined,
      metadata: row.metadata as Record<string, string> | undefined,
    };
  }

  async findByProcessor(input: {
    processor: string;
    processorId: string;
  }): Promise<CustomerRecord | null> {
    const row = await this.model.findOne({
      where: {
        processor: input.processor,
        processor_id: input.processorId,
      },
    });

    if (row === null) {
      return null;
    }

    return {
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      processor: row.processor,
      processorId: row.processorId,
      email: row.email ?? undefined,
      metadata: row.metadata as Record<string, string> | undefined,
    };
  }
}
