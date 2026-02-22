import type { IdempotencyRepository } from "../../core/contracts.ts";
import type { SolidusIdempotencyKey } from "../models/SolidusIdempotencyKey.ts";

export class SolidusIdempotencyRepository implements IdempotencyRepository {
  constructor(private model: typeof SolidusIdempotencyKey) {}

  async reserve(input: {
    key: string;
    scope: string;
  }): Promise<"created" | "exists"> {
    try {
      await this.model.create({
        key: input.key,
        scope: input.scope,
      });

      return "created";
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        return "exists";
      }

      throw error;
    }
  }

  async release(input: {
    key: string;
    scope: string;
  }): Promise<void> {
    await this.model.destroy({
      where: {
        key: input.key,
        scope: input.scope,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
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
}
