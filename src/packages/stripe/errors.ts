import { ActionRequiredError, ConfigurationError, ProviderError } from "../core/errors.ts";

interface StripeErrorLike {
  readonly type?: string;
  readonly code?: string;
  readonly message?: string;
  readonly payment_intent?: {
    id?: string;
    client_secret?: string | null;
    status?: string;
  };
}

function asStripeErrorLike(error: unknown): StripeErrorLike {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  return error as StripeErrorLike;
}

export function mapStripeError(error: unknown, operation: string): Error {
  const stripeError = asStripeErrorLike(error);
  const message = stripeError.message ?? `Stripe ${operation} failed.`;

  if (
    stripeError.code === "authentication_required" ||
    stripeError.payment_intent?.status === "requires_action"
  ) {
    return new ActionRequiredError(message, {
      cause: error,
      details: {
        provider: "stripe",
        operation,
        paymentIntentId: stripeError.payment_intent?.id,
        clientSecret: stripeError.payment_intent?.client_secret ?? undefined,
        stripeCode: stripeError.code,
      },
    });
  }

  if (stripeError.type === "StripeInvalidRequestError") {
    return new ConfigurationError(message, {
      cause: error,
      details: {
        provider: "stripe",
        operation,
        stripeCode: stripeError.code,
      },
    });
  }

  return new ProviderError(message, {
    cause: error,
    details: {
      provider: "stripe",
      operation,
      stripeCode: stripeError.code,
      stripeType: stripeError.type,
    },
  });
}
