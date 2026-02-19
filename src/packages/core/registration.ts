import type {
  CustomerModelDefinition,
  CustomerRegistry,
  RegisteredCustomerModel,
} from "./contracts.ts";
import {
  ActionRequiredError,
  ConfigurationError,
  IdempotencyConflictError,
} from "./errors.ts";

export class InMemoryCustomerRegistry implements CustomerRegistry {
  private readonly registrations = new Map<string, RegisteredCustomerModel>();
  private defaultModelName?: string;

  register<TRecord, TOwner>(
    definition: CustomerModelDefinition<TRecord, TOwner>,
  ): RegisteredCustomerModel<TRecord, TOwner> {
    const modelName = definition.modelName.trim();

    if (modelName.length === 0) {
      throw new ConfigurationError("Customer model registration requires a modelName.");
    }

    if (this.registrations.has(modelName)) {
      throw new IdempotencyConflictError(`Customer model \"${modelName}\" is already registered.`, {
        details: { modelName },
      });
    }

    if (definition.isDefault && this.defaultModelName !== undefined) {
      throw new ConfigurationError("Only one default customer model can be registered.", {
        details: {
          nextDefault: modelName,
          existingDefault: this.defaultModelName,
        },
      });
    }

    const shouldBeDefault = definition.isDefault ?? this.defaultModelName === undefined;

    const registration: RegisteredCustomerModel<TRecord, TOwner> = {
      ...definition,
      modelName,
      isDefault: shouldBeDefault,
    };

    this.registrations.set(modelName, registration as RegisteredCustomerModel);

    if (shouldBeDefault) {
      this.defaultModelName = modelName;
    }

    return registration;
  }

  get(modelName: string): RegisteredCustomerModel | undefined {
    return this.registrations.get(modelName);
  }

  getDefault(): RegisteredCustomerModel | undefined {
    if (this.defaultModelName === undefined) {
      return undefined;
    }

    return this.registrations.get(this.defaultModelName);
  }

  list(): readonly RegisteredCustomerModel[] {
    return Array.from(this.registrations.values());
  }
}

export function createCustomerRegistry(): CustomerRegistry {
  return new InMemoryCustomerRegistry();
}

export function registerCustomerModel<TRecord, TOwner>(
  registry: CustomerRegistry,
  definition: CustomerModelDefinition<TRecord, TOwner>,
): RegisteredCustomerModel<TRecord, TOwner> {
  return registry.register(definition);
}

export function resolveOwnerOrThrow<TRecord, TOwner>(
  registration: Pick<RegisteredCustomerModel<TRecord, TOwner>, "modelName" | "resolveOwner">,
  record: TRecord,
): TOwner {
  const owner = registration.resolveOwner(record);

  if (owner === null || owner === undefined) {
    throw new ActionRequiredError(
      `Could not resolve owner for customer model \"${registration.modelName}\".`,
      {
        details: { modelName: registration.modelName },
      },
    );
  }

  return owner;
}

export function toSafeClientReferenceId(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw new ConfigurationError("Client reference id cannot be empty.");
    }

    return trimmed;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  throw new ConfigurationError("Client reference id must be a string, number, bigint, or undefined.", {
    details: { receivedType: typeof value },
  });
}

export function resolveClientReferenceId<TRecord>(
  registration: Pick<RegisteredCustomerModel<TRecord>, "getClientReferenceId">,
  record: TRecord,
): string | undefined {
  if (!registration.getClientReferenceId) {
    return undefined;
  }

  return toSafeClientReferenceId(registration.getClientReferenceId(record));
}
