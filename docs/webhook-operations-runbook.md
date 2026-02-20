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
- Transition metrics are emitted through the optional metric hook:
  - `webhook.ingest.received.count`
  - `webhook.ingest.transition.count`
  - `webhook.process.started.count`
  - `webhook.process.transition.count`
  - `webhook.lag.ms` tagged by status (`processed`, `retrying`, `dead_letter`)

## Health diagnostics

- Use `getWebhookHealthDiagnostics` to monitor:
  - `pendingCount`
  - `retryingCount`
  - `deadLetterCount`
  - `oldestLagMs`
  - `warnings` (`LAG_THRESHOLD_EXCEEDED`, `DEAD_LETTER_THRESHOLD_EXCEEDED`)
- Recommended threshold baseline:
  - `lagWarningThresholdMs`: 120000 for near-real-time systems.
  - `deadLetterWarningThreshold`: 1 in production.

## Stuck or retrying events

1. Inspect events with `nextAttemptAt` in the past that are not `processedAt`.
2. Confirm worker is draining due jobs from outbox.
3. Check `lastError` for root cause (missing config, downstream API outage, projection bug).
4. Fix issue, then re-enqueue by event ID.

## Secret rotation playbook

1. Configure both old and new webhook secrets.
2. Deploy and confirm traffic verifies using either secret.
3. Watch `webhook.ingest.transition.count` and signature errors for at least 15 minutes.
4. Rotate Stripe endpoint to emit signatures with new secret.
5. Confirm only new-secret signatures are arriving and no verification failures occur.
6. Remove old secret after verification window.

Rollback:

- Re-add the previous secret immediately if verification errors rise.
- Keep both secrets configured until verification stability is restored.

## Incident checklist

- Verify route uses `express.raw({ type: "application/json" })`.
- Confirm `Stripe-Signature` header is present at ingress.
- Confirm required webhook events are enabled in Stripe endpoint settings.
- Validate duplicate delivery handling by event ID idempotency key.

## Outage handling playbook

1. Confirm ingestion still accepts and persists events (check duplicate/queued ingest transitions).
2. Inspect `getWebhookHealthDiagnostics` for backlog growth and warning state.
3. If downstream system is degraded, allow retries to absorb transient failures.
4. If dead-letter grows, fix the root cause and selectively replay affected event IDs.
5. During recovery, increase worker drain frequency and track `webhook.lag.ms` downtrend.
6. Close incident when lag and retrying counts return to baseline.
