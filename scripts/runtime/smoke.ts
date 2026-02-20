import {
  createCustomerRegistry,
  createFacadePlaceholder,
  diagnoseStripeWebhookEvents,
  m1FoundationSchema,
} from "../../index.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const registry = createCustomerRegistry();
assert(typeof registry.register === "function", "createCustomerRegistry should return a registry.");

const stripeDiagnostics = diagnoseStripeWebhookEvents([]);
assert(
  stripeDiagnostics.missingRequiredEvents.length > 0,
  "diagnoseStripeWebhookEvents should detect missing required events.",
);

const facade = createFacadePlaceholder();
assert(facade.package === "facade", "createFacadePlaceholder should expose facade package.");

assert(
  m1FoundationSchema.tables.customers !== undefined,
  "m1FoundationSchema should expose sequelize schema metadata.",
);

console.log("Runtime smoke checks passed.");
