import type Stripe from "stripe";
import { ConfigurationError, SignatureVerificationError } from "../core/errors.ts";
import type { WebhookPipeline } from "../core/webhooks.ts";
import { diagnoseStripeWebhookEvents, verifyStripeWebhookEvent } from "../stripe/webhooks.ts";

type HeaderValue = string | readonly string[] | undefined;

export interface ExpressLikeRequest {
  readonly headers: Record<string, HeaderValue>;
  body: unknown;
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  send(body?: unknown): void;
  json(body: unknown): void;
}

export type ExpressLikeNext = (error?: unknown) => void;

export type ExpressLikeHandler = (
  request: ExpressLikeRequest,
  response: ExpressLikeResponse,
  next: ExpressLikeNext,
) => void | Promise<void>;

export interface ExpressLikeRouter {
  post(path: string, ...handlers: ExpressLikeHandler[]): void;
}

export interface ExpressLikeModule {
  Router(): ExpressLikeRouter;
  raw(options: { type: string }): ExpressLikeHandler;
}

function readHeader(headers: Record<string, HeaderValue>, name: string): string | undefined {
  const lowerName = name.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0];
    }

    return undefined;
  }

  return undefined;
}

function isRawBody(value: unknown): value is string | Uint8Array {
  return typeof value === "string" || value instanceof Uint8Array;
}

export interface StripeWebhookConfigurationDiagnostics {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export function diagnoseStripeWebhookConfiguration(input: {
  webhookSecrets: readonly string[];
  configuredEvents?: readonly string[];
}): StripeWebhookConfigurationDiagnostics {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validSecrets = input.webhookSecrets.filter((secret) => secret.trim().length > 0);

  if (validSecrets.length === 0) {
    errors.push("Stripe webhook signing secret is missing.");
  }

  if (validSecrets.length > 1) {
    warnings.push("Multiple Stripe webhook signing secrets configured; this is expected during secret rotation.");
  }

  if (input.configuredEvents !== undefined) {
    const diagnostics = diagnoseStripeWebhookEvents(input.configuredEvents);

    if (diagnostics.missingRequiredEvents.length > 0) {
      warnings.push(
        `Stripe webhook endpoint is missing required events: ${diagnostics.missingRequiredEvents.join(", ")}.`,
      );
    }
  }

  return { errors, warnings };
}

export function createStripeWebhookRawBodyMiddleware(): ExpressLikeHandler {
  return (_request, _response, next) => {
    next();
  };
}

export function createStripeWebhookHandler(input: {
  stripe: Stripe;
  webhookSecrets: readonly string[];
  pipeline: WebhookPipeline;
  now?: () => Date;
}): ExpressLikeHandler {
  const now = input.now ?? (() => new Date());

  return async (request, response, next) => {
    try {
      if (!isRawBody(request.body)) {
        throw new SignatureVerificationError(
          "Stripe webhook request body is not raw bytes. Use route-local express.raw middleware.",
          {
            details: {
              reason: "parsed_body",
            },
          },
        );
      }

      const signatureHeader = readHeader(request.headers, "Stripe-Signature");
      const event = await verifyStripeWebhookEvent({
        stripe: input.stripe,
        payload: request.body,
        signatureHeader,
        webhookSecrets: input.webhookSecrets,
      });

      const result = await input.pipeline.ingest({
        processor: "stripe",
        eventId: event.id,
        eventType: event.type,
        payload: event,
        receivedAt: now(),
      });

      response.status(200).json({
        received: true,
        duplicate: result.status === "duplicate",
      });
    } catch (error: unknown) {
      if (error instanceof SignatureVerificationError || error instanceof ConfigurationError) {
        response.status(400).json({
          received: false,
          error: error.code,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };
}

export function createStripeWebhookRouter(input: {
  express: ExpressLikeModule;
  stripe: Stripe;
  webhookSecrets: readonly string[];
  pipeline: WebhookPipeline;
  routePath?: string;
}): ExpressLikeRouter {
  const router = input.express.Router();
  const routePath = input.routePath ?? "/webhooks/stripe";
  const rawBodyMiddleware = input.express.raw({ type: "application/json" });
  const compatibilityMiddleware = createStripeWebhookRawBodyMiddleware();
  const handler = createStripeWebhookHandler({
    stripe: input.stripe,
    webhookSecrets: input.webhookSecrets,
    pipeline: input.pipeline,
  });

  router.post(routePath, rawBodyMiddleware, compatibilityMiddleware, handler);
  return router;
}
