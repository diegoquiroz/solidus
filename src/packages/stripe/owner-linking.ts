import type { CustomerRegistry } from "../core/contracts.ts";
import {
  MalformedCheckoutClientReferenceError,
  UnknownCheckoutClientReferenceModelError,
} from "./errors.ts";

export interface ParsedCheckoutClientReference {
  modelName: string;
  ownerId: string;
}

function splitReference(clientReferenceId: string): ParsedCheckoutClientReference {
  const trimmed = clientReferenceId.trim();

  if (trimmed.length === 0) {
    throw new MalformedCheckoutClientReferenceError("Checkout client reference id cannot be empty.", {
      clientReferenceId,
    });
  }

  const underscoreIndex = trimmed.indexOf("_");

  if (underscoreIndex <= 0) {
    throw new MalformedCheckoutClientReferenceError(
      "Checkout client reference id must use the format <ModelName>_<OwnerId>.",
      {
        clientReferenceId,
      },
    );
  }

  const modelName = trimmed.slice(0, underscoreIndex).trim();
  const ownerId = trimmed.slice(underscoreIndex + 1).trim();

  if (modelName.length === 0 || ownerId.length === 0) {
    throw new MalformedCheckoutClientReferenceError(
      "Checkout client reference id must use the format <ModelName>_<OwnerId>.",
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

export function tryParseCheckoutClientReferenceId(input: {
  clientReferenceId: string;
  customerRegistry: CustomerRegistry;
}): ParsedCheckoutClientReference | null {
  try {
    return parseCheckoutClientReferenceId(input);
  } catch {
    return null;
  }
}

export function parseCheckoutClientReferenceId(input: {
  clientReferenceId: string;
  customerRegistry: CustomerRegistry;
}): ParsedCheckoutClientReference {
  const parsed = splitReference(input.clientReferenceId);
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
