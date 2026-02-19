# Stripe Webhook Map (Pay -> Solidus)

This file maps Stripe events currently handled by Pay and the expected side effects to replicate in Solidus.

Primary source:
- `/Users/diego/Developer/clones/pay/lib/pay/stripe.rb`
- `/Users/diego/Developer/clones/pay/lib/pay/stripe/webhooks/*.rb`

## Ingestion pipeline (current Pay behavior)

1. Receive event at `/pay/webhooks/stripe`.
2. Verify signature using `Stripe-Signature` and configured signing secret(s).
3. Ignore test events if production config disables them.
4. Persist payload into webhook table.
5. Process asynchronously via job.
6. Instrument event bus (`pay.stripe.<event_type>`) and dispatch subscribers.

Sources:
- `/Users/diego/Developer/clones/pay/app/controllers/pay/webhooks/stripe_controller.rb`
- `/Users/diego/Developer/clones/pay/app/models/pay/webhook.rb`
- `/Users/diego/Developer/clones/pay/lib/pay/webhooks/delegator.rb`

## Event coverage table

- `charge.succeeded`
  - Handler: `charge_succeeded.rb`
  - Effects: sync charge record, send receipt email if enabled.
- `charge.refunded`
  - Handler: `charge_refunded.rb`
  - Effects: sync refund state, send refund email if enabled.
- `charge.updated`
  - Handler: `charge_updated.rb`
  - Effects: refresh charge projection only.
- `payment_intent.succeeded`
  - Handler: `payment_intent_succeeded.rb`
  - Effects: sync latest charge; no email to avoid duplicates with `charge.succeeded`.

- `invoice.upcoming`
  - Handler: `subscription_renewing.rb`
  - Effects: send renewal warning email (typically yearly plans).
- `invoice.payment_action_required`
  - Handler: `payment_action_required.rb`
  - Effects: identify subscription/invoice payment intent and notify customer action required.
- `invoice.payment_failed`
  - Handler: `payment_failed.rb`
  - Effects: notify customer payment failed.

- `customer.subscription.created`
  - Handler: `subscription_created.rb`
  - Effects: create/sync subscription projection.
- `customer.subscription.updated`
  - Handler: `subscription_updated.rb`
  - Effects: update subscription state (plan, quantity, status, periods, pause metadata).
- `customer.subscription.deleted`
  - Handler: `subscription_deleted.rb`
  - Effects: mark subscription ended/canceled via sync.
- `customer.subscription.trial_will_end`
  - Handler: `subscription_trial_will_end.rb`
  - Effects: sync and send trial ending/ended notices.

- `customer.updated`
  - Handler: `customer_updated.rb`
  - Effects: update customer object snapshot, credit balance, default payment method linkage.
- `customer.deleted`
  - Handler: `customer_deleted.rb`
  - Effects: mark customer deleted, unset defaults, cancel active subs, remove payment methods.

- `payment_method.attached`
  - Handler: `payment_method_attached.rb`
  - Effects: sync payment method projection.
- `payment_method.updated`
  - Handler: `payment_method_updated.rb`
  - Effects: sync update or delete local record if detached from customer.
- `payment_method.card_automatically_updated`
  - Handler: `payment_method_updated.rb`
  - Effects: same as above.
- `payment_method.detached`
  - Handler: `payment_method_detached.rb`
  - Effects: delete local payment method projection.

- `account.updated`
  - Handler: `account_updated.rb`
  - Effects: sync merchant onboarding status (`charges_enabled`).

- `checkout.session.completed`
  - Handler: `checkout_session_completed.rb`
  - Effects: optional owner linking via `client_reference_id`, then charge/subscription sync.
- `checkout.session.async_payment_succeeded`
  - Handler: `checkout_session_async_payment_succeeded.rb`
  - Effects: same as checkout completed for delayed methods.

## Implementation requirements for Solidus

- Must keep event processing idempotent by Stripe event ID.
- Must persist event payload before business processing.
- Must acknowledge webhook quickly (2xx) and process downstream async.
- Must expose custom subscription hooks:
  - subscribe handler
  - unsubscribe handler
  - global handler
- Must document required events list and provide a startup diagnostic that compares configured events vs required set.

## Express-specific notes

- Webhook route must use route-local raw body parser (`express.raw({ type: 'application/json' })`) before any JSON parser touches the payload.
- Regular routes can still use global `express.json()`.
- Signature verification should fail fast with clear diagnostics for:
  - missing secret
  - wrong secret (CLI vs dashboard)
  - parsed/modified body

References:
- Context7 `/stripe/stripe-node` webhook `constructEvent` usage
- Context7 `/expressjs/express` middleware ordering and route scoping
