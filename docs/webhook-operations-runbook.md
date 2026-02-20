# Webhook Operations Runbook (M3)

## Queue modes

- `inline`: Runs processing immediately when the event is ingested. Best for local development and tests.
- `db-outbox`: Persists jobs and lets workers drain due jobs. Recommended for production.
- `db-outbox` adapter behavior: `runAt` defaults to adapter `now()` when omitted, and queued retries honor explicit `runAt` values.
- `drainDbOutboxQueue` drains jobs where `runAt <= now`, defaults `limit` to `100`, and acknowledges jobs after processing.

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

## Required observability fields for troubleshooting

- Required log fields for every webhook log entry:
  - `level`
  - `event`
  - `message`
  - `processor`
  - `eventId`
  - `timestamp`
- Required log fields by transition context:
  - Ingest logs (`webhook.ingest.*`): `eventType` when available, and `status` for transition outcomes (`queued`, `duplicate`).
  - Process success (`webhook.process.processed`): `eventType`, `status: processed`, `attemptCount`, `lagMs`.
  - Process retry (`webhook.process.retrying`): `eventType`, `status: retrying`, `attemptCount`, `lagMs`, `error`.
  - Dead letter (`webhook.process.dead_letter`): `eventType`, `status: dead_letter`, `attemptCount`, `lagMs`, `error`.
- Required metric sample fields:
  - `name`
  - `value`
  - `unit` (`count` or `ms`)
  - `tags.status` for transition and lag metrics
  - `tags.processor` for transition and lag metrics
  - `tags.eventType` for event-scoped transition and lag metrics

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

## Replay playbook

1. Identify target event IDs from dead-letter records or persisted events (`processor`, `eventId`, `eventType`, `lastError`, `attemptCount`).
2. Confirm root cause is fixed before replay.
3. Replay by enqueueing `webhook.process` jobs keyed by `{ processor, eventId }`:
   - For `db-outbox`, enqueue with `runAt: now` and let workers drain due jobs.
   - For `inline`, call processing path directly and verify synchronous completion.
4. Track replay outcomes via:
   - Logs: `webhook.process.processed`, `webhook.process.retrying`, `webhook.process.dead_letter`.
   - Metrics: `webhook.process.transition.count` and `webhook.lag.ms` for replayed IDs.
5. Stop replay batch and re-triage if retrying or dead-letter growth continues.

## Dead-letter triage

1. Group dead-letter events by `eventType` and `lastError` to isolate blast radius.
2. Validate required Stripe events are enabled (see `docs/stripe-webhook-coverage-matrix.md`).
3. Check whether failures are effect-specific:
   - Default effects synchronize customer, payment method, charge, invoice, subscription, and account-related projections.
   - `payment_intent.succeeded` intentionally suppresses subscriber fan-out to avoid duplicate side effects.
4. For connected account traffic, verify account context resolution order:
   - Explicit `resolveRequestOptions` override, then Stripe `event.account`, then stored customer `connectedAccountId`.
5. Replay only affected IDs after fix; monitor lag and transition metrics until baseline recovers.

## Common failure signatures

- Signature/middleware ordering issues:
  - `SIGNATURE_VERIFICATION_ERROR` with parsed body hint.
  - Missing `Stripe-Signature` header.
- Endpoint configuration issues:
  - `CONFIGURATION_ERROR` when webhook secret list is empty.
  - `WEBHOOK_EVENT_REJECTED` when livemode policy rejects event mode.
- Processing failures:
  - Repeating `webhook.process.retrying` logs with increasing `attemptCount` and stable `lastError`.
  - `webhook.process.dead_letter` with `attemptCount >= maxAttempts` and non-empty `error`.
- Queue/worker failures:
  - Persisted events with overdue `nextAttemptAt` and no matching `webhook.process.started` or transition logs.
  - Growing `oldestLagMs` and warnings from `getWebhookHealthDiagnostics`.

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
