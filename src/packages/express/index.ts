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

export interface StripeWebhookEventModePolicy {
  readonly allowLiveEvents?: boolean;
  readonly allowTestEvents?: boolean;
}

export interface StripeWebhookHandlerLogEntry {
  readonly level: "warn";
  readonly event: "stripe.webhook.rejected";
  readonly message: string;
  readonly processor: "stripe";
  readonly eventId: string;
  readonly eventType: string;
  readonly livemode: boolean;
  readonly reason: "live_events_disabled" | "test_events_disabled";
  readonly timestamp: Date;
}

export interface StripeWebhookHandlerObservability {
  readonly log?: (entry: StripeWebhookHandlerLogEntry) => void | Promise<void>;
}

interface NormalizedStripeWebhookEventModePolicy {
  readonly allowLiveEvents: boolean;
  readonly allowTestEvents: boolean;
}

function normalizeStripeWebhookEventModePolicy(
  policy: StripeWebhookEventModePolicy | undefined,
): NormalizedStripeWebhookEventModePolicy {
  return {
    allowLiveEvents: policy?.allowLiveEvents ?? true,
    allowTestEvents: policy?.allowTestEvents ?? true,
  };
}

async function emitHandlerLog(
  observability: StripeWebhookHandlerObservability | undefined,
  entry: StripeWebhookHandlerLogEntry,
): Promise<void> {
  if (observability?.log === undefined) {
    return;
  }

  try {
    await observability.log(entry);
  } catch {
    // Swallow observability hook failures to preserve webhook behavior.
  }
}

function isEventAllowedByModePolicy(
  event: Stripe.Event,
  policy: NormalizedStripeWebhookEventModePolicy,
): { allowed: true } | { allowed: false; reason: "live_events_disabled" | "test_events_disabled" } {
  if (event.livemode) {
    if (policy.allowLiveEvents) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "live_events_disabled",
    };
  }

  if (policy.allowTestEvents) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "test_events_disabled",
  };
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
  eventModePolicy?: StripeWebhookEventModePolicy;
  observability?: StripeWebhookHandlerObservability;
}): ExpressLikeHandler {
  const now = input.now ?? (() => new Date());
  const eventModePolicy = normalizeStripeWebhookEventModePolicy(input.eventModePolicy);

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

      const modePolicyCheck = isEventAllowedByModePolicy(event, eventModePolicy);

      if (!modePolicyCheck.allowed) {
        const timestamp = now();
        await emitHandlerLog(input.observability, {
          level: "warn",
          event: "stripe.webhook.rejected",
          message: "Stripe webhook event rejected by configured livemode policy.",
          processor: "stripe",
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          reason: modePolicyCheck.reason,
          timestamp,
        });

        response.status(400).json({
          received: false,
          error: "WEBHOOK_EVENT_REJECTED",
          message: "Stripe webhook event rejected by configured livemode policy.",
          details: {
            reason: modePolicyCheck.reason,
            livemode: event.livemode,
          },
        });
        return;
      }

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
  eventModePolicy?: StripeWebhookEventModePolicy;
  observability?: StripeWebhookHandlerObservability;
}): ExpressLikeRouter {
  const router = input.express.Router();
  const routePath = input.routePath ?? "/webhooks/stripe";
  const rawBodyMiddleware = input.express.raw({ type: "application/json" });
  const compatibilityMiddleware = createStripeWebhookRawBodyMiddleware();
  const handler = createStripeWebhookHandler({
    stripe: input.stripe,
    webhookSecrets: input.webhookSecrets,
    pipeline: input.pipeline,
    eventModePolicy: input.eventModePolicy,
    observability: input.observability,
  });

  router.post(routePath, rawBodyMiddleware, compatibilityMiddleware, handler);
  return router;
}
