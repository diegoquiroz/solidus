# Runtime Compatibility

Solidus is tested for core package imports and key adapter-safe behavior across Node.js, Bun, and Deno.

## Supported Runtime Matrix

| Runtime | Supported version | Smoke command | Notes |
| --- | --- | --- | --- |
| Node.js | 22.x | `bun run test:runtime:node` | Uses `--experimental-strip-types` to execute TypeScript directly. |
| Bun | 1.x | `bun run test:runtime:bun` | Primary development runtime for this repository. |
| Deno | 2.x | `bun run test:runtime:deno` | Uses npm interoperability (`--node-modules-dir=auto`). |

## Caveats

- Stripe webhook payload conversion is runtime-safe and no longer relies on direct `Buffer` usage in the webhook verifier.
- Adapter code paths may still depend on host-framework behavior (for example, Express raw body middleware).
- Runtime smoke tests validate importability and core behavior, not external service integrations.
- For full confidence, run targeted package tests in addition to runtime smoke checks.
