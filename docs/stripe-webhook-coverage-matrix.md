# Stripe Webhook Coverage Matrix (M3)

| Event | Handler behavior | Notes |
| --- | --- | --- |
| `charge.succeeded` | Sync charge projection by charge ID | Subscriber notification enabled |
| `charge.refunded` | Sync charge projection by charge ID | Subscriber notification enabled |
| `charge.updated` | Sync charge projection by charge ID | Subscriber notification enabled |
| `payment_intent.succeeded` | Sync charge projection by payment intent ID | Subscriber notification suppressed to avoid duplicate side effects |
| `invoice.upcoming` | Trigger upcoming-renewal notification hook | Matches Pay renewal warning path |
| `invoice.payment_action_required` | Trigger action-required notification hook | Includes payment intent ID when present |
| `invoice.payment_failed` | Trigger payment-failed notification hook | Subscriber notification enabled |
| `customer.subscription.created` | Sync subscription projection by subscription ID | Subscriber notification enabled |
| `customer.subscription.updated` | Sync subscription projection by subscription ID | Subscriber notification enabled |
| `customer.subscription.deleted` | Sync subscription projection by subscription ID | Subscriber notification enabled |
| `customer.subscription.trial_will_end` | Sync subscription projection + trial warning hook | Subscriber notification enabled |
| `customer.updated` | Sync customer projection by customer ID | Subscriber notification enabled |
| `customer.deleted` | Delete/cancel customer projection by customer ID | Subscriber notification enabled |
| `payment_method.attached` | Sync payment method projection by payment method ID | Subscriber notification enabled |
| `payment_method.updated` | Sync payment method projection by payment method ID | Subscriber notification enabled |
| `payment_method.card_automatically_updated` | Sync payment method projection by payment method ID | Subscriber notification enabled |
| `payment_method.detached` | Delete payment method projection by payment method ID | Subscriber notification enabled |
| `account.updated` | Sync connected account projection by account ID | Subscriber notification enabled |
| `checkout.session.completed` | Optional owner link by `client_reference_id` + sync charge/subscription | Subscriber notification enabled |
| `checkout.session.async_payment_succeeded` | Sync charge/subscription for delayed methods | Subscriber notification enabled |

Fixtures covering every mapped event live in `src/packages/stripe/__tests__/fixtures/webhook-events.json`.
