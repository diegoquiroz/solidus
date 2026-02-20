import type { CustomerRegistry } from "../core/contracts.ts";
import {
  MalformedCheckoutClientReferenceError,
  UnknownCheckoutClientReferenceModelError,
} from "./errors.ts";

export interface ParsedCheckoutClientReference {
  modelName: string;
  ownerId: string;
}

function splitReference(clientReferenceId: string): { modelName?: string; ownerId: string } {
  const trimmed = clientReferenceId.trim();

  if (trimmed.length === 0) {
    throw new MalformedCheckoutClientReferenceError("Checkout client reference id cannot be empty.", {
      clientReferenceId,
    });
  }

  const colonIndex = trimmed.indexOf(":");

  if (colonIndex <= 0) {
    return { ownerId: trimmed };
  }

  const modelName = trimmed.slice(0, colonIndex).trim();
  const ownerId = trimmed.slice(colonIndex + 1).trim();

  if (modelName.length === 0 || ownerId.length === 0) {
    throw new MalformedCheckoutClientReferenceError(
      "Checkout client reference id must use the format <ModelName>:<OwnerId>.",
      {
        clientReferenceId,
      },
    );
  }

  return {
    modelName,
    ownerId,
  };
}

export function parseCheckoutClientReferenceId(input: {
  clientReferenceId: string;
  customerRegistry: CustomerRegistry;
}): ParsedCheckoutClientReference {
  const parsed = splitReference(input.clientReferenceId);

  if (parsed.modelName === undefined) {
    const fallbackModel = input.customerRegistry.getDefault();

    if (fallbackModel === undefined) {
      throw new UnknownCheckoutClientReferenceModelError(
        "Checkout client reference id did not include a model and no default customer model is registered.",
        {
          clientReferenceId: input.clientReferenceId,
        },
      );
    }

    return {
      modelName: fallbackModel.modelName,
      ownerId: parsed.ownerId,
    };
  }

  const registration = input.customerRegistry.get(parsed.modelName);

  if (registration === undefined) {
    throw new UnknownCheckoutClientReferenceModelError(
      `Checkout client reference model \"${parsed.modelName}\" is not registered.`,
      {
        clientReferenceId: input.clientReferenceId,
        modelName: parsed.modelName,
      },
    );
  }

  return {
    modelName: registration.modelName,
    ownerId: parsed.ownerId,
  };
}
