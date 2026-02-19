type ErrorDetails = Record<string, unknown>;

interface SolidusErrorOptions {
  code?: string;
  cause?: unknown;
  details?: ErrorDetails;
}

export class SolidusError extends Error {
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(message: string, options: SolidusErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "SolidusError";
    this.code = options.code ?? "SOLIDUS_ERROR";
    this.details = options.details;
  }
}

export class ProviderError extends SolidusError {
  constructor(message: string, options: Omit<SolidusErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "PROVIDER_ERROR" });
    this.name = "ProviderError";
  }
}

export class ActionRequiredError extends SolidusError {
  constructor(message: string, options: Omit<SolidusErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "ACTION_REQUIRED" });
    this.name = "ActionRequiredError";
  }
}

export class ConfigurationError extends SolidusError {
  constructor(message: string, options: Omit<SolidusErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "CONFIGURATION_ERROR" });
    this.name = "ConfigurationError";
  }
}

export class SignatureVerificationError extends SolidusError {
  constructor(message: string, options: Omit<SolidusErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SIGNATURE_VERIFICATION_ERROR" });
    this.name = "SignatureVerificationError";
  }
}

export class IdempotencyConflictError extends SolidusError {
  constructor(message: string, options: Omit<SolidusErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "IDEMPOTENCY_CONFLICT" });
    this.name = "IdempotencyConflictError";
  }
}
