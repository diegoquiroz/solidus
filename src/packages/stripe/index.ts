import { ConfigurationError } from "../core/errors.ts";

export interface StripeAdapterPlaceholder {
  readonly provider: "stripe";
  readonly status: "not_implemented";
}

export function createStripeAdapterPlaceholder(): StripeAdapterPlaceholder {
  return {
    provider: "stripe",
    status: "not_implemented",
  };
}

export function assertStripeAdapterImplemented(): never {
  throw new ConfigurationError("Stripe adapter is not implemented yet.");
}
