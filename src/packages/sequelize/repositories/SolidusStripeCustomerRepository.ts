import type { StripeCustomerProjection, StripeCustomerProjectionRepository } from "../../stripe/core-apis.ts";
import type { SolidusStripeCustomer } from "../models/SolidusStripeCustomer.ts";

export class SolidusStripeCustomerRepository implements StripeCustomerProjectionRepository {
  constructor(private model: typeof SolidusStripeCustomer) {}

  async upsert(customer: StripeCustomerProjection): Promise<void> {
    await this.model.upsert({
      processor: customer.processor,
      processorId: customer.processorId,
      email: customer.email,
      rawPayload: customer.rawPayload as unknown as Record<string, unknown>,
    });
  }

  async findByProcessorId(processorId: string): Promise<StripeCustomerProjection | null> {
    const row = await this.model.findOne({
      where: {
        processor_id: processorId,
      },
    });

    if (row === null) {
      return null;
    }

    return {
      processor: row.processor as "stripe",
      processorId: row.processorId,
      email: row.email ?? undefined,
      metadata: row.rawPayload?.metadata as Record<string, string> | undefined,
      rawPayload: row.rawPayload as unknown as import("stripe").default.Customer,
    };
  }
}
