# Core Contracts API (Generated)

Generated at: 2026-02-19T22:42:50.500Z

## Contracts

### Customer registry
- `CustomerRegistry`: register customer-enabled models, fetch by model name, and retrieve default mapping.
- `CustomerModelDefinition`: stable registration input with `modelName`, `resolveOwner`, optional `getClientReferenceId`, and optional `isDefault`.
- `RegisteredCustomerModel`: normalized registration output where `isDefault` is always set.

### Repositories
- `CustomerRepository`: persistence contract for saving and loading customer projections by owner.
- `IdempotencyRepository`: reservation and release contract for idempotency keys by scope.
- `SolidusRepositories`: grouped repository dependency object.

### Queue and events
- `QueueAdapter`: enqueue background work through a runtime-agnostic adapter.
- `EventBus`: publish domain events to any messaging transport.
- `QueueJob` and `DomainEvent`: shared eventing payload shapes.

## Error taxonomy
- `SolidusError` (base)
- `ProviderError`
- `ActionRequiredError`
- `ConfigurationError`
- `SignatureVerificationError`
- `IdempotencyConflictError`

## Registration API
- `registerCustomerModel(registry, definition)`: register a model equivalent to Pay's `pay_customer` declaration.
- `resolveOwnerOrThrow(registration, record)`: enforce owner resolution and raise `ActionRequiredError` when missing.
- `resolveClientReferenceId(registration, record)` and `toSafeClientReferenceId(value)`: normalize references into provider-safe strings.

### User model example
```ts
import {
  createCustomerRegistry,
  registerCustomerModel,
  resolveClientReferenceId,
  resolveOwnerOrThrow,
} from "@diegoquiroz/solidus";

const registry = createCustomerRegistry();

const userRegistration = registerCustomerModel(registry, {
  modelName: "User",
  resolveOwner: (user: { account: { id: string } | null }) => user.account,
  getClientReferenceId: (user: { id: number }) => user.id,
  isDefault: true,
});

const owner = resolveOwnerOrThrow(userRegistration, {
  account: { id: "acct_42" },
  id: 42,
});

const clientReferenceId = resolveClientReferenceId(userRegistration, {
  account: owner,
  id: 42,
});
```

## Pay migration notes
- Pay's `pay_customer` declaration maps to `registerCustomerModel(...)`.
- Set owner relationship rules in `resolveOwner`.
- Move `client_reference_id` derivation into `getClientReferenceId` and let safety helpers normalize values.
