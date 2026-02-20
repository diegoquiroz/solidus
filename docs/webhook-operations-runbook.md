# Webhook Operations Runbook (M3)

## Queue modes

- `inline`: Runs processing immediately when the event is ingested. Best for local development and tests.
- `db-outbox`: Persists jobs and lets workers drain due jobs. Recommended for production.

## Retry and dead-letter behavior

- Processing uses exponential backoff.
- Default retry policy:
  - `maxAttempts: 5`
  - `baseDelayMs: 500`
  - `backoffMultiplier: 2`
  - `maxDelayMs: 30000`
- After `maxAttempts`, event is marked dead-letter with `deadLetteredAt` and `lastError`.

## Stuck or retrying events

1. Inspect events with `nextAttemptAt` in the past that are not `processedAt`.
2. Confirm worker is draining due jobs from outbox.
3. Check `lastError` for root cause (missing config, downstream API outage, projection bug).
4. Fix issue, then re-enqueue by event ID.

## Secret rotation playbook

1. Configure both old and new webhook secrets.
2. Deploy and confirm traffic verifies using either secret.
3. Rotate Stripe endpoint to emit signatures with new secret.
4. Remove old secret after verification window.

## Incident checklist

- Verify route uses `express.raw({ type: "application/json" })`.
- Confirm `Stripe-Signature` header is present at ingress.
- Confirm required webhook events are enabled in Stripe endpoint settings.
- Validate duplicate delivery handling by event ID idempotency key.
