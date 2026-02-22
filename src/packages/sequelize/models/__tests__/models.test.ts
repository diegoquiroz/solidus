import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Sequelize, DataTypes } from "sequelize";
import {
  SolidusCustomer,
  initSolidusCustomer,
  SolidusCharge,
  initSolidusCharge,
  SolidusSubscription,
  initSolidusSubscription,
  SolidusPaymentMethod,
  initSolidusPaymentMethod,
  SolidusInvoice,
  initSolidusInvoice,
  SolidusWebhookEvent,
  initSolidusWebhookEvent,
  SolidusWebhookOutbox,
  initSolidusWebhookOutbox,
  SolidusIdempotencyKey,
  initSolidusIdempotencyKey,
  SolidusStripeCustomer,
  initSolidusStripeCustomer,
} from "../index.ts";

describe("Solidus Models", () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    });

    // Initialize all models
    initSolidusCustomer(sequelize);
    initSolidusCharge(sequelize);
    initSolidusSubscription(sequelize);
    initSolidusPaymentMethod(sequelize);
    initSolidusInvoice(sequelize);
    initSolidusWebhookEvent(sequelize);
    initSolidusWebhookOutbox(sequelize);
    initSolidusIdempotencyKey(sequelize);
    initSolidusStripeCustomer(sequelize);

    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe("Model Initialization", () => {
    test("all 9 models initialize without errors", () => {
      expect(SolidusCustomer).toBeDefined();
      expect(SolidusCharge).toBeDefined();
      expect(SolidusSubscription).toBeDefined();
      expect(SolidusPaymentMethod).toBeDefined();
      expect(SolidusInvoice).toBeDefined();
      expect(SolidusWebhookEvent).toBeDefined();
      expect(SolidusWebhookOutbox).toBeDefined();
      expect(SolidusIdempotencyKey).toBeDefined();
      expect(SolidusStripeCustomer).toBeDefined();
    });

    test("models have correct table names with solidus_ prefix", () => {
      expect(SolidusCustomer.getTableName()).toBe("solidus_customers");
      expect(SolidusCharge.getTableName()).toBe("solidus_charges");
      expect(SolidusSubscription.getTableName()).toBe("solidus_subscriptions");
      expect(SolidusPaymentMethod.getTableName()).toBe("solidus_payment_methods");
      expect(SolidusInvoice.getTableName()).toBe("solidus_invoices");
      expect(SolidusWebhookEvent.getTableName()).toBe("solidus_webhooks");
      expect(SolidusWebhookOutbox.getTableName()).toBe("solidus_webhook_outbox");
      expect(SolidusIdempotencyKey.getTableName()).toBe("solidus_idempotency_keys");
      expect(SolidusStripeCustomer.getTableName()).toBe("solidus_stripe_customers");
    });

    test("models have UUID primary keys that auto-generate", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "123",
        processor: "stripe",
        processorId: "cus_test_1",
      });

      expect(customer.id).toBeDefined();
      expect(typeof customer.id).toBe("string");
      expect(customer.id).toHaveLength(36); // UUID length
    });

    test("models have timestamps enabled", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "456",
        processor: "stripe",
        processorId: "cus_test_2",
      });

      expect(customer.createdAt).toBeInstanceOf(Date);
      expect(customer.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("SolidusCustomer", () => {
    test("can create customer with owner_type and owner_id", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "Workspace",
        ownerId: "ws_123",
        processor: "stripe",
        processorId: "cus_workspace_123",
        email: "billing@example.com",
      });

      expect(customer.ownerType).toBe("Workspace");
      expect(customer.ownerId).toBe("ws_123");
      expect(customer.email).toBe("billing@example.com");
    });

    test("can find by owner", async () => {
      await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "user_789",
        processor: "stripe",
        processorId: "cus_user_789",
      });

      const found = await SolidusCustomer.findOne({
        where: {
          ownerType: "User",
          ownerId: "user_789",
        },
      });

      expect(found).not.toBeNull();
      expect(found?.processorId).toBe("cus_user_789");
    });

    test("isDefault defaults to false", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "Org",
        ownerId: "org_1",
        processor: "stripe",
        processorId: "cus_org_1",
      });

      expect(customer.isDefault).toBe(false);
    });

    test("metadata defaults to empty object", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "Org",
        ownerId: "org_2",
        processor: "stripe",
        processorId: "cus_org_2",
      });

      expect(customer.metadata).toEqual({});
    });

    test("can update customer records", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "user_update",
        processor: "stripe",
        processorId: "cus_update_test",
        email: "old@example.com",
      });

      await customer.update({ email: "new@example.com" });

      const updated = await SolidusCustomer.findByPk(customer.id);
      expect(updated?.email).toBe("new@example.com");
    });

    test("can destroy customer records", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "user_delete",
        processor: "stripe",
        processorId: "cus_delete_test",
      });

      await customer.destroy();

      const found = await SolidusCustomer.findByPk(customer.id);
      expect(found).toBeNull();
    });

    test("required columns reject null values", async () => {
      await expect(
        SolidusCustomer.create({
          ownerType: null as unknown as string,
          ownerId: "test",
          processor: "stripe",
          processorId: "cus_test",
        })
      ).rejects.toThrow();
    });

    test("optional columns accept null values", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "null_test",
        processor: "stripe",
        processorId: "cus_null_test",
        email: null,
        merchantId: null,
      });

      expect(customer.email).toBeNull();
      expect(customer.merchantId).toBeNull();
    });
  });

  describe("SolidusCharge", () => {
    test("can create charge with required fields", async () => {
      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_123",
        customerProcessorId: "cus_123",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: { id: "ch_123", object: "charge" },
      });

      expect(charge.amount).toBe(1000);
      expect(charge.currency).toBe("usd");
      expect(charge.status).toBe("succeeded");
    });

    test("metadata defaults to empty object", async () => {
      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_metadata",
        customerProcessorId: "cus_123",
        amount: 500,
        currency: "eur",
        status: "pending",
        rawPayload: {},
      });

      expect(charge.metadata).toEqual({});
    });

    test("optional date fields accept null", async () => {
      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_dates",
        customerProcessorId: "cus_123",
        amount: 2000,
        currency: "gbp",
        status: "pending",
        capturedAt: null,
        receiptUrl: null,
        rawPayload: {},
      });

      expect(charge.capturedAt).toBeNull();
      expect(charge.receiptUrl).toBeNull();
    });

    test("JSONB columns work correctly", async () => {
      const taxAmounts = { tax: [{ amount: 100, rate: "10%" }] };
      const snapshot = { card: { brand: "visa", last4: "4242" } };

      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_json",
        customerProcessorId: "cus_123",
        amount: 3000,
        currency: "usd",
        status: "succeeded",
        totalTaxAmounts: taxAmounts,
        paymentMethodSnapshot: snapshot,
        rawPayload: { source: "test" },
      });

      expect(charge.totalTaxAmounts).toEqual(taxAmounts);
      expect(charge.paymentMethodSnapshot).toEqual(snapshot);
    });

    test("can find charges by processor_id", async () => {
      await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_find_me",
        customerProcessorId: "cus_123",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: {},
      });

      const found = await SolidusCharge.findOne({
        where: { processorId: "ch_find_me" },
      });

      expect(found).not.toBeNull();
      expect(found?.processorId).toBe("ch_find_me");
    });

    test("required fields reject null values", async () => {
      await expect(
        SolidusCharge.create({
          processor: "stripe",
          processorId: "ch_fail",
          customerProcessorId: "cus_123",
          amount: null as unknown as number,
          currency: "usd",
          status: "succeeded",
          rawPayload: {},
        })
      ).rejects.toThrow();
    });
  });

  describe("SolidusSubscription", () => {
    test("can create subscription with required fields", async () => {
      const subscription = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_123",
        customerProcessorId: "cus_123",
        status: "active",
        rawPayload: { id: "sub_123", object: "subscription" },
      });

      expect(subscription.status).toBe("active");
      expect(subscription.processorId).toBe("sub_123");
    });

    test("quantity defaults to 1", async () => {
      const subscription = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_qty",
        customerProcessorId: "cus_123",
        status: "active",
        rawPayload: {},
      });

      expect(subscription.quantity).toBe(1);
    });

    test("cancelAtPeriodEnd defaults to false", async () => {
      const subscription = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_cancel",
        customerProcessorId: "cus_123",
        status: "active",
        rawPayload: {},
      });

      expect(subscription.cancelAtPeriodEnd).toBe(false);
    });

    test("trial dates are optional", async () => {
      const subscription = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_trial",
        customerProcessorId: "cus_123",
        status: "trialing",
        trialEndsAt: new Date("2024-12-31"),
        currentPeriodStart: new Date("2024-01-01"),
        currentPeriodEnd: new Date("2024-12-31"),
        rawPayload: {},
      });

      expect(subscription.trialEndsAt).toBeInstanceOf(Date);
      expect(subscription.currentPeriodStart).toBeInstanceOf(Date);
      expect(subscription.currentPeriodEnd).toBeInstanceOf(Date);
    });

    test("paused behavior has constrained values", async () => {
      const subscription = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_paused",
        customerProcessorId: "cus_123",
        status: "paused",
        pausedBehavior: "void",
        pausedResumesAt: new Date("2024-06-01"),
        rawPayload: {},
      });

      expect(subscription.pausedBehavior).toBe("void");
      expect(subscription.pausedResumesAt).toBeInstanceOf(Date);
    });

    test("can find by customer processor id", async () => {
      await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_cust",
        customerProcessorId: "cus_specific",
        status: "active",
        rawPayload: {},
      });

      const found = await SolidusSubscription.findOne({
        where: { customerProcessorId: "cus_specific" },
      });

      expect(found).not.toBeNull();
      expect(found?.customerProcessorId).toBe("cus_specific");
    });
  });

  describe("SolidusPaymentMethod", () => {
    test("can create payment method with card details", async () => {
      const paymentMethod = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_123",
        customerProcessorId: "cus_123",
        methodType: "card",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2025,
        rawPayload: { id: "pm_123", card: { brand: "visa" } },
      });

      expect(paymentMethod.brand).toBe("visa");
      expect(paymentMethod.last4).toBe("4242");
      expect(paymentMethod.expMonth).toBe(12);
      expect(paymentMethod.expYear).toBe(2025);
    });

    test("isDefault defaults to false", async () => {
      const paymentMethod = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_default",
        customerProcessorId: "cus_123",
        methodType: "card",
        rawPayload: {},
      });

      expect(paymentMethod.isDefault).toBe(false);
    });

    test("metadata defaults to empty object", async () => {
      const paymentMethod = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_meta",
        customerProcessorId: "cus_123",
        methodType: "card",
        rawPayload: {},
      });

      expect(paymentMethod.metadata).toEqual({});
    });

    test("card details are optional", async () => {
      const paymentMethod = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_no_card",
        customerProcessorId: "cus_123",
        methodType: "paypal",
        brand: null,
        last4: null,
        expMonth: null,
        expYear: null,
        rawPayload: { type: "paypal" },
      });

      expect(paymentMethod.brand).toBeNull();
      expect(paymentMethod.last4).toBeNull();
    });

    test("can update payment method", async () => {
      const paymentMethod = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_update",
        customerProcessorId: "cus_123",
        methodType: "card",
        brand: "visa",
        last4: "0000",
        rawPayload: {},
      });

      await paymentMethod.update({
        brand: "mastercard",
        last4: "9999",
        isDefault: true,
      });

      const updated = await SolidusPaymentMethod.findByPk(paymentMethod.id);
      expect(updated?.brand).toBe("mastercard");
      expect(updated?.last4).toBe("9999");
      expect(updated?.isDefault).toBe(true);
    });
  });

  describe("SolidusInvoice", () => {
    test("can create invoice with required fields", async () => {
      const invoice = await SolidusInvoice.create({
        processor: "stripe",
        processorId: "in_123",
        status: "open",
        rawPayload: { id: "in_123", object: "invoice" },
      });

      expect(invoice.status).toBe("open");
      expect(invoice.processorId).toBe("in_123");
    });

    test("can create invoice with amount details", async () => {
      const invoice = await SolidusInvoice.create({
        processor: "stripe",
        processorId: "in_amounts",
        customerProcessorId: "cus_123",
        subscriptionProcessorId: "sub_123",
        status: "paid",
        amountDue: 5000,
        amountPaid: 5000,
        currency: "usd",
        dueAt: new Date("2024-01-15"),
        paidAt: new Date("2024-01-10"),
        rawPayload: {},
      });

      expect(invoice.amountDue).toBe(5000);
      expect(invoice.amountPaid).toBe(5000);
      expect(invoice.currency).toBe("usd");
    });

    test("optional fields accept null", async () => {
      const invoice = await SolidusInvoice.create({
        processor: "stripe",
        processorId: "in_optional",
        status: "draft",
        customerProcessorId: null,
        subscriptionProcessorId: null,
        amountDue: null,
        currency: null,
        dueAt: null,
        paidAt: null,
        rawPayload: {},
      });

      expect(invoice.customerProcessorId).toBeNull();
      expect(invoice.amountDue).toBeNull();
      expect(invoice.dueAt).toBeNull();
    });

    test("can find by processor_id", async () => {
      await SolidusInvoice.create({
        processor: "stripe",
        processorId: "in_find",
        status: "open",
        rawPayload: {},
      });

      const found = await SolidusInvoice.findOne({
        where: { processorId: "in_find" },
      });

      expect(found).not.toBeNull();
      expect(found?.processorId).toBe("in_find");
    });
  });

  describe("SolidusWebhookEvent", () => {
    test("can create webhook event with required fields", async () => {
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_123",
        eventType: "charge.succeeded",
        payload: { id: "evt_123", type: "charge.succeeded" },
        receivedAt: new Date(),
      });

      expect(event.eventId).toBe("evt_123");
      expect(event.eventType).toBe("charge.succeeded");
      expect(event.processor).toBe("stripe");
    });

    test("attemptCount defaults to 0", async () => {
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_attempt",
        eventType: "invoice.created",
        payload: {},
      });

      expect(event.attemptCount).toBe(0);
    });

    test("failureCount defaults to 0", async () => {
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_failure",
        eventType: "invoice.created",
        payload: {},
      });

      expect(event.failureCount).toBe(0);
    });

    test("receivedAt defaults to NOW", async () => {
      const before = new Date();
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_received",
        eventType: "customer.created",
        payload: {},
      });
      const after = new Date();

      expect(event.receivedAt).toBeInstanceOf(Date);
      expect(event.receivedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.receivedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test("can mark event as processed", async () => {
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_process",
        eventType: "charge.succeeded",
        payload: {},
      });

      const processedAt = new Date();
      await event.update({ processedAt });

      const updated = await SolidusWebhookEvent.findByPk(event.id);
      expect(updated?.processedAt).toEqual(processedAt);
    });

    test("can update attempt count and error", async () => {
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_retry",
        eventType: "invoice.payment_failed",
        payload: {},
      });

      const nextAttemptAt = new Date(Date.now() + 60000);
      await event.update({
        attemptCount: 2,
        nextAttemptAt,
        lastError: "Connection timeout",
      });

      const updated = await SolidusWebhookEvent.findByPk(event.id);
      expect(updated?.attemptCount).toBe(2);
      expect(updated?.lastError).toBe("Connection timeout");
      expect(updated?.nextAttemptAt).toEqual(nextAttemptAt);
    });

    test("can mark as dead lettered", async () => {
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_dlq",
        eventType: "payment_intent.failed",
        payload: {},
      });

      const deadLetteredAt = new Date();
      await event.update({
        deadLetteredAt,
        failureCount: 3,
        lastError: "Max retries exceeded",
      });

      const updated = await SolidusWebhookEvent.findByPk(event.id);
      expect(updated?.deadLetteredAt).toEqual(deadLetteredAt);
      expect(updated?.failureCount).toBe(3);
    });
  });

  describe("SolidusWebhookOutbox", () => {
    test("can create outbox entry with required fields", async () => {
      const entry = await SolidusWebhookOutbox.create({
        jobName: "webhook.process",
        jobPayload: { eventId: "evt_123", processor: "stripe" },
      });

      expect(entry.jobName).toBe("webhook.process");
      expect(entry.jobPayload).toEqual({ eventId: "evt_123", processor: "stripe" });
    });

    test("runAt defaults to NOW", async () => {
      const before = new Date();
      const entry = await SolidusWebhookOutbox.create({
        jobName: "test.job",
        jobPayload: {},
      });
      const after = new Date();

      expect(entry.runAt).toBeInstanceOf(Date);
      expect(entry.runAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.runAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test("merchantId is optional", async () => {
      const entry = await SolidusWebhookOutbox.create({
        jobName: "test.job",
        jobPayload: {},
        merchantId: null,
      });

      expect(entry.merchantId).toBeNull();
    });

    test("jobIdempotencyKey is optional", async () => {
      const entry = await SolidusWebhookOutbox.create({
        jobName: "test.job",
        jobPayload: {},
        jobIdempotencyKey: "unique-key-123",
      });

      expect(entry.jobIdempotencyKey).toBe("unique-key-123");
    });

    test("can schedule job for future", async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const entry = await SolidusWebhookOutbox.create({
        jobName: "delayed.job",
        jobPayload: { data: "test" },
        runAt: futureDate,
      });

      expect(entry.runAt).toEqual(futureDate);
    });

    test("JSONB payload stores complex objects", async () => {
      const complexPayload = {
        event: {
          id: "evt_complex",
          type: "invoice.payment_succeeded",
          data: {
            object: {
              id: "in_123",
              amount: 5000,
            },
          },
        },
        metadata: { source: "webhook", version: 1 },
      };

      const entry = await SolidusWebhookOutbox.create({
        jobName: "webhook.process",
        jobPayload: complexPayload,
      });

      expect(entry.jobPayload).toEqual(complexPayload);
    });
  });

  describe("SolidusIdempotencyKey", () => {
    test("can create idempotency key with required fields", async () => {
      const key = await SolidusIdempotencyKey.create({
        key: "req_123",
        scope: "charge",
      });

      expect(key.key).toBe("req_123");
      expect(key.scope).toBe("charge");
    });

    test("enforces unique constraint on key and scope", async () => {
      await SolidusIdempotencyKey.create({
        key: "unique_key",
        scope: "payment",
      });

      // Should throw on duplicate
      await expect(
        SolidusIdempotencyKey.create({
          key: "unique_key",
          scope: "payment",
        })
      ).rejects.toThrow();
    });

    test("same key with different scopes is allowed", async () => {
      await SolidusIdempotencyKey.create({
        key: "shared_key",
        scope: "charge",
      });

      const differentScope = await SolidusIdempotencyKey.create({
        key: "shared_key",
        scope: "subscription",
      });

      expect(differentScope.key).toBe("shared_key");
      expect(differentScope.scope).toBe("subscription");
    });

    test("can delete idempotency key", async () => {
      const key = await SolidusIdempotencyKey.create({
        key: "temp_key",
        scope: "temp",
      });

      await key.destroy();

      const found = await SolidusIdempotencyKey.findByPk(key.id);
      expect(found).toBeNull();
    });
  });

  describe("SolidusStripeCustomer", () => {
    test("can create Stripe customer projection", async () => {
      const customer = await SolidusStripeCustomer.create({
        processor: "stripe",
        processorId: "cus_stripe_123",
        email: "customer@example.com",
        name: "John Doe",
        description: "Test customer",
        phone: "+1234567890",
        balance: 0,
        currency: "usd",
        delinquent: false,
        invoicePrefix: "7B8C9D",
        rawPayload: { id: "cus_stripe_123", object: "customer" },
      });

      expect(customer.processorId).toBe("cus_stripe_123");
      expect(customer.email).toBe("customer@example.com");
      expect(customer.name).toBe("John Doe");
    });

    test("optional fields accept null", async () => {
      const customer = await SolidusStripeCustomer.create({
        processor: "stripe",
        processorId: "cus_minimal",
        rawPayload: { id: "cus_minimal" },
        email: null,
        name: null,
        description: null,
        phone: null,
        balance: null,
        currency: null,
        delinquent: null,
        invoicePrefix: null,
      });

      expect(customer.email).toBeNull();
      expect(customer.name).toBeNull();
      expect(customer.balance).toBeNull();
    });

    test("enforces unique constraint on processor and processorId", async () => {
      await SolidusStripeCustomer.create({
        processor: "stripe",
        processorId: "cus_unique",
        rawPayload: { id: "cus_unique" },
      });

      await expect(
        SolidusStripeCustomer.create({
          processor: "stripe",
          processorId: "cus_unique",
          rawPayload: { id: "cus_unique_duplicate" },
        })
      ).rejects.toThrow();
    });

    test("can find by processorId", async () => {
      await SolidusStripeCustomer.create({
        processor: "stripe",
        processorId: "cus_find",
        email: "find@example.com",
        rawPayload: { id: "cus_find" },
      });

      const found = await SolidusStripeCustomer.findOne({
        where: { processorId: "cus_find" },
      });

      expect(found).not.toBeNull();
      expect(found?.email).toBe("find@example.com");
    });

    test("can update customer projection", async () => {
      const customer = await SolidusStripeCustomer.create({
        processor: "stripe",
        processorId: "cus_update",
        email: "old@example.com",
        name: "Old Name",
        rawPayload: { id: "cus_update" },
      });

      await customer.update({
        email: "new@example.com",
        name: "New Name",
        balance: 1000,
      });

      const updated = await SolidusStripeCustomer.findByPk(customer.id);
      expect(updated?.email).toBe("new@example.com");
      expect(updated?.name).toBe("New Name");
      expect(updated?.balance).toBe(1000);
    });
  });

  describe("Cross-Model Associations", () => {
    test("customerId can be set on related models", async () => {
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "assoc_user",
        processor: "stripe",
        processorId: "cus_assoc",
      });

      const charge = await SolidusCharge.create({
        customerId: customer.id,
        processor: "stripe",
        processorId: "ch_assoc",
        customerProcessorId: "cus_assoc",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: {},
      });

      const subscription = await SolidusSubscription.create({
        customerId: customer.id,
        processor: "stripe",
        processorId: "sub_assoc",
        customerProcessorId: "cus_assoc",
        status: "active",
        rawPayload: {},
      });

      const paymentMethod = await SolidusPaymentMethod.create({
        customerId: customer.id,
        processor: "stripe",
        processorId: "pm_assoc",
        customerProcessorId: "cus_assoc",
        methodType: "card",
        rawPayload: {},
      });

      expect(charge.customerId).toBe(customer.id);
      expect(subscription.customerId).toBe(customer.id);
      expect(paymentMethod.customerId).toBe(customer.id);
    });

    test("can find charges by customerProcessorId", async () => {
      await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_cust_1",
        customerProcessorId: "cus_lookup",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: {},
      });

      await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_cust_2",
        customerProcessorId: "cus_lookup",
        amount: 2000,
        currency: "usd",
        status: "succeeded",
        rawPayload: {},
      });

      const charges = await SolidusCharge.findAll({
        where: { customerProcessorId: "cus_lookup" },
      });

      expect(charges.length).toBe(2);
      expect(charges.map((c) => c.processorId).sort()).toEqual([
        "ch_cust_1",
        "ch_cust_2",
      ]);
    });

    test("can find subscriptions by customerProcessorId", async () => {
      await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_cust_1",
        customerProcessorId: "cus_subs",
        status: "active",
        rawPayload: {},
      });

      await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_cust_2",
        customerProcessorId: "cus_subs",
        status: "canceled",
        rawPayload: {},
      });

      const subscriptions = await SolidusSubscription.findAll({
        where: { customerProcessorId: "cus_subs" },
      });

      expect(subscriptions.length).toBe(2);
    });

    test("can find payment methods by customerProcessorId", async () => {
      await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_cust_1",
        customerProcessorId: "cus_pms",
        methodType: "card",
        brand: "visa",
        rawPayload: {},
      });

      await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_cust_2",
        customerProcessorId: "cus_pms",
        methodType: "card",
        brand: "mastercard",
        rawPayload: {},
      });

      const methods = await SolidusPaymentMethod.findAll({
        where: { customerProcessorId: "cus_pms" },
      });

      expect(methods.length).toBe(2);
      expect(methods.map((m) => m.brand).sort()).toEqual([
        "mastercard",
        "visa",
      ]);
    });
  });

  describe("CRUD Operations Summary", () => {
    test("complete CRUD lifecycle for Customer", async () => {
      // Create
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "crud_user",
        processor: "stripe",
        processorId: "cus_crud",
        email: "crud@example.com",
      });
      expect(customer.id).toBeDefined();

      // Read
      const found = await SolidusCustomer.findByPk(customer.id);
      expect(found?.email).toBe("crud@example.com");

      // Update
      await found?.update({ email: "updated@example.com" });
      const updated = await SolidusCustomer.findByPk(customer.id);
      expect(updated?.email).toBe("updated@example.com");

      // Delete
      await updated?.destroy();
      const deleted = await SolidusCustomer.findByPk(customer.id);
      expect(deleted).toBeNull();
    });

    test("complete CRUD lifecycle for Charge", async () => {
      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_crud",
        customerProcessorId: "cus_crud",
        amount: 5000,
        currency: "usd",
        status: "pending",
        rawPayload: { initial: true },
      });

      const found = await SolidusCharge.findByPk(charge.id);
      expect(found?.status).toBe("pending");

      await found?.update({ status: "succeeded", capturedAt: new Date() });
      const updated = await SolidusCharge.findByPk(charge.id);
      expect(updated?.status).toBe("succeeded");

      await updated?.destroy();
      expect(await SolidusCharge.findByPk(charge.id)).toBeNull();
    });

    test("complete CRUD lifecycle for Subscription", async () => {
      const sub = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_crud",
        customerProcessorId: "cus_crud",
        status: "incomplete",
        rawPayload: {},
      });

      const found = await SolidusSubscription.findByPk(sub.id);
      expect(found?.status).toBe("incomplete");

      await found?.update({ status: "active", currentPeriodStart: new Date() });
      const updated = await SolidusSubscription.findByPk(sub.id);
      expect(updated?.status).toBe("active");

      await updated?.destroy();
      expect(await SolidusSubscription.findByPk(sub.id)).toBeNull();
    });

    test("complete CRUD lifecycle for PaymentMethod", async () => {
      const pm = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_crud",
        customerProcessorId: "cus_crud",
        methodType: "card",
        isDefault: false,
        rawPayload: {},
      });

      const found = await SolidusPaymentMethod.findByPk(pm.id);
      expect(found?.isDefault).toBe(false);

      await found?.update({ isDefault: true, expMonth: 12, expYear: 2025 });
      const updated = await SolidusPaymentMethod.findByPk(pm.id);
      expect(updated?.isDefault).toBe(true);

      await updated?.destroy();
      expect(await SolidusPaymentMethod.findByPk(pm.id)).toBeNull();
    });
  });

  describe("JSON Column Tests", () => {
    test("all models with JSON columns store and retrieve correctly", async () => {
      // Customer metadata
      const customer = await SolidusCustomer.create({
        ownerType: "User",
        ownerId: "json_test",
        processor: "stripe",
        processorId: "cus_json",
        metadata: { plan: "premium", source: "web" },
      });
      expect(customer.metadata).toEqual({ plan: "premium", source: "web" });

      // Charge rawPayload and metadata
      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_json",
        customerProcessorId: "cus_json",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: { payment_method: "card_123", receipt: true },
        metadata: { order_id: "order_123" },
      });
      expect(charge.rawPayload).toEqual({
        payment_method: "card_123",
        receipt: true,
      });
      expect(charge.metadata).toEqual({ order_id: "order_123" });

      // Subscription rawPayload
      const subscription = await SolidusSubscription.create({
        processor: "stripe",
        processorId: "sub_json",
        customerProcessorId: "cus_json",
        status: "active",
        rawPayload: { items: [{ price: "price_123" }] },
      });
      expect(subscription.rawPayload).toEqual({
        items: [{ price: "price_123" }],
      });

      // PaymentMethod rawPayload and metadata
      const pm = await SolidusPaymentMethod.create({
        processor: "stripe",
        processorId: "pm_json",
        customerProcessorId: "cus_json",
        methodType: "card",
        rawPayload: { card: { brand: "visa", last4: "4242" } },
        metadata: { verified: true },
      });
      expect(pm.rawPayload).toEqual({
        card: { brand: "visa", last4: "4242" },
      });
      expect(pm.metadata).toEqual({ verified: true });

      // Invoice rawPayload
      const invoice = await SolidusInvoice.create({
        processor: "stripe",
        processorId: "in_json",
        status: "paid",
        rawPayload: { lines: [{ amount: 5000 }] },
      });
      expect(invoice.rawPayload).toEqual({ lines: [{ amount: 5000 }] });

      // WebhookEvent payload
      const event = await SolidusWebhookEvent.create({
        processor: "stripe",
        eventId: "evt_json",
        eventType: "charge.succeeded",
        payload: { data: { object: { id: "ch_123" } } },
      });
      expect(event.payload).toEqual({
        data: { object: { id: "ch_123" } },
      });

      // WebhookOutbox jobPayload
      const outbox = await SolidusWebhookOutbox.create({
        jobName: "webhook.process",
        jobPayload: { event: { id: "evt_123", type: "invoice.paid" } },
      });
      expect(outbox.jobPayload).toEqual({
        event: { id: "evt_123", type: "invoice.paid" },
      });

      // StripeCustomer rawPayload
      const stripeCustomer = await SolidusStripeCustomer.create({
        processor: "stripe",
        processorId: "cus_stripe_json",
        rawPayload: { id: "cus_stripe_json", balance: 0 },
      });
      expect(stripeCustomer.rawPayload).toEqual({
        id: "cus_stripe_json",
        balance: 0,
      });
    });

    test("JSON columns can store nested objects and arrays", async () => {
      const complexData = {
        user: {
          preferences: {
            theme: "dark",
            notifications: ["email", "sms"],
          },
        },
        metadata: {
          tags: ["important", "billing"],
          history: [{ date: "2024-01-01", action: "created" }],
        },
      };

      const charge = await SolidusCharge.create({
        processor: "stripe",
        processorId: "ch_complex",
        customerProcessorId: "cus_complex",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        rawPayload: complexData,
      });

      const rawPayload = charge.rawPayload as typeof complexData;
      expect(rawPayload.user.preferences.theme).toBe("dark");
      expect(rawPayload.user.preferences.notifications).toEqual([
        "email",
        "sms",
      ]);
      expect(rawPayload.metadata.tags).toEqual(["important", "billing"]);
      expect(rawPayload.metadata.history[0]?.action).toBe("created");
    });
  });
});
