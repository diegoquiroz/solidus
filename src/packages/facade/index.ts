import { ConfigurationError } from "../core/errors.ts";

export interface FacadePlaceholder {
  readonly package: "facade";
  readonly status: "not_implemented";
}

export function createFacadePlaceholder(): FacadePlaceholder {
  return {
    package: "facade",
    status: "not_implemented",
  };
}

export function assertFacadeImplemented(): never {
  throw new ConfigurationError("Facade package is not implemented yet.");
}
