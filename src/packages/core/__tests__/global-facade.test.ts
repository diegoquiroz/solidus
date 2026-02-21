import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  configure,
  getGlobalFacade,
  isConfigured,
  resetConfiguration,
  SolidusNotConfiguredError,
  SolidusAlreadyConfiguredError,
  Solidus,
} from "../global-facade.ts";
import { createBillingMixin, solidusBillingMixin, SolidusNotConfiguredError as ModelExtensionNotConfiguredError } from "../model-extension.ts";
import type { createSolidusFacade } from "../../facade/index.ts";
import type Stripe from "stripe";

const mockFacade = {
  api: {
    charges: {
      charge: async () => ({
        id: "ch_test",
        processor: "stripe",
        processorId: "pi_test",
        customerProcessorId: "cus_test",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: {},
      }),
    },
    subscriptions: {
      create: async () => ({
        id: "sub_rec_test",
        processor: "stripe",
        processorId: "sub_test",
        customerProcessorId: "cus_test",
        status: "active",
        cancelAtPeriodEnd: false,
        rawPayload: {},
      }),
    },
  },
  convenience: {
    setOwnerStripeProcessor: async () => ({
      owner: { ownerType: "Workspace", ownerId: "123" },
      processor: "stripe" as const,
      customerId: "cus_test",
      customer: { id: "cus_test" } as Stripe.Customer,
    }),
    syncCustomer: async () => ({ id: "cus_test" } as Stripe.Customer),
    syncSubscriptions: async () => [],
  },
  webhooks: {
    process: async () => {},
    delegator: {} as ReturnType<typeof createSolidusFacade>["webhooks"]["delegator"],
  },
} as unknown as ReturnType<typeof createSolidusFacade>;

describe("global-facade", () => {
  beforeEach(() => {
    resetConfiguration();
  });

  afterEach(() => {
    resetConfiguration();
  });

  describe("configure", () => {
    test("sets up global facade", () => {
      expect(isConfigured()).toBe(false);

      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      expect(isConfigured()).toBe(true);
    });

    test("throws when already configured", () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      expect(() =>
        configure({
          createFacade: () => mockFacade,
          stripe: {} as Stripe,
        }),
      ).toThrow(SolidusAlreadyConfiguredError);
    });
  });

  describe("getGlobalFacade", () => {
    test("returns configured facade", () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      const facade = getGlobalFacade();
      expect(facade).toBe(mockFacade);
    });

    test("throws when not configured", () => {
      expect(() => getGlobalFacade()).toThrow(SolidusNotConfiguredError);
    });
  });

  describe("Solidus namespace", () => {
    test("provides configure method", () => {
      Solidus.configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      expect(Solidus.isConfigured()).toBe(true);
    });

    test("provides getFacade method", () => {
      Solidus.configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      const facade = Solidus.getFacade();
      expect(facade).toBe(mockFacade);
    });

    test("provides reset method", () => {
      Solidus.configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      expect(Solidus.isConfigured()).toBe(true);

      Solidus.reset();

      expect(Solidus.isConfigured()).toBe(false);
    });
  });
});

describe("model-extension", () => {
  beforeEach(() => {
    resetConfiguration();
  });

  afterEach(() => {
    resetConfiguration();
  });

  describe("createBillingMixin", () => {
    test("returns billing operations for owner instance", async () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
        name: string;
      }

      const workspace: Workspace = { id: "123", name: "Test Workspace" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);

      expect(billing).toBeDefined();
      expect(typeof billing.setProcessor).toBe("function");
      expect(typeof billing.charge).toBe("function");
      expect(typeof billing.subscribe).toBe("function");
    });

    test("setProcessor calls facade.convenience.setOwnerStripeProcessor", async () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);
      const result = await billing.setProcessor();

      expect(result.customerId).toBe("cus_test");
      expect(result.owner.ownerType).toBe("Workspace");
      expect(result.owner.ownerId).toBe("123");
    });

    test("charge creates charge with auto-resolved customer", async () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);
      const result = await billing.charge({
        amount: 1000,
        currency: "usd",
      });

      expect(result.processorId).toBe("pi_test");
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe("usd");
    });

    test("subscribe creates subscription with auto-resolved customer", async () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);
      const result = await billing.subscribe({
        priceId: "price_monthly",
      });

      expect(result.processorId).toBe("sub_test");
      expect(result.status).toBe("active");
    });

    test("throws when global facade not configured", async () => {
      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);

      expect(() => billing.setProcessor()).toThrow(SolidusNotConfiguredError);
    });

    test("uses provided facade instance instead of global", async () => {
      // Don't configure global facade

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
        facade: mockFacade,
      });

      const billing = billingMixin(workspace);

      // Should not throw since we're using instance-specific facade
      const result = await billing.setProcessor();
      expect(result.customerId).toBe("cus_test");
    });
  });

  describe("solidusBillingMixin", () => {
    test("exports same functionality as createBillingMixin", () => {
      expect(typeof solidusBillingMixin).toBe("function");
      
      interface TestOwner {
        id: string;
      }
      
      const mixin1 = createBillingMixin<TestOwner>({
        ownerType: "Test",
        getOwnerId: (instance) => instance.id,
      });
      
      const mixin2 = solidusBillingMixin<TestOwner>({
        ownerType: "Test",
        getOwnerId: (instance) => instance.id,
      });
      
      // Both should create valid billing mixins
      expect(typeof mixin1).toBe("function");
      expect(typeof mixin2).toBe("function");
    });
  });

  describe("getCustomerId", () => {
    test("returns customer ID from syncCustomer", async () => {
      configure({
        createFacade: () => mockFacade,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);
      const customerId = await billing.getCustomerId();

      expect(customerId).toBe("cus_test");
    });

    test("returns null when no customer exists", async () => {
      const mockFacadeNoCustomer = {
        ...mockFacade,
        convenience: {
          ...mockFacade.convenience,
          syncCustomer: async () => null,
        },
      };

      configure({
        createFacade: () => mockFacadeNoCustomer as unknown as ReturnType<typeof createSolidusFacade>,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);
      const customerId = await billing.getCustomerId();

      expect(customerId).toBeNull();
    });
  });

  describe("syncSubscriptions", () => {
    test("returns subscriptions for owner", async () => {
      const mockSubscription: Stripe.Subscription = {
        id: "sub_123",
        object: "subscription",
      } as Stripe.Subscription;

      const mockFacadeWithSubs = {
        ...mockFacade,
        convenience: {
          ...mockFacade.convenience,
          syncSubscriptions: async () => [mockSubscription],
        },
      };

      configure({
        createFacade: () => mockFacadeWithSubs as unknown as ReturnType<typeof createSolidusFacade>,
        stripe: {} as Stripe,
      });

      interface Workspace {
        id: string;
      }

      const workspace: Workspace = { id: "123" };

      const billingMixin = createBillingMixin<Workspace>({
        ownerType: "Workspace",
        getOwnerId: (instance) => instance.id,
      });

      const billing = billingMixin(workspace);
      const subscriptions = await billing.syncSubscriptions();

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]!.id).toBe("sub_123");
    });
  });
});
