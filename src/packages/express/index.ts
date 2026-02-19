import { ConfigurationError } from "../core/errors.ts";

export interface ExpressAdapterPlaceholder {
  readonly framework: "express";
  readonly status: "not_implemented";
}

export function createExpressAdapterPlaceholder(): ExpressAdapterPlaceholder {
  return {
    framework: "express",
    status: "not_implemented",
  };
}

export function assertExpressAdapterImplemented(): never {
  throw new ConfigurationError("Express adapter is not implemented yet.");
}
