import type { Sequelize } from "sequelize";
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
} from "./models/index.ts";

export interface InitializeSolidusModelsOptions {
  tablePrefix?: string;
  schema?: string;
}

export interface SolidusModels {
  Customer: typeof SolidusCustomer;
  Charge: typeof SolidusCharge;
  Subscription: typeof SolidusSubscription;
  PaymentMethod: typeof SolidusPaymentMethod;
  Invoice: typeof SolidusInvoice;
  WebhookEvent: typeof SolidusWebhookEvent;
  WebhookOutbox: typeof SolidusWebhookOutbox;
  IdempotencyKey: typeof SolidusIdempotencyKey;
  StripeCustomer: typeof SolidusStripeCustomer;
}

export function initializeSolidusModels(
  sequelize: Sequelize,
  options?: InitializeSolidusModelsOptions,
): SolidusModels {
  const tablePrefix = options?.tablePrefix ?? "solidus_";
  const schema = options?.schema;

  initSolidusCustomer(sequelize, tablePrefix, schema);
  initSolidusCharge(sequelize, tablePrefix, schema);
  initSolidusSubscription(sequelize, tablePrefix, schema);
  initSolidusPaymentMethod(sequelize, tablePrefix, schema);
  initSolidusInvoice(sequelize, tablePrefix, schema);
  initSolidusWebhookEvent(sequelize, tablePrefix, schema);
  initSolidusWebhookOutbox(sequelize, tablePrefix, schema);
  initSolidusIdempotencyKey(sequelize, tablePrefix, schema);
  initSolidusStripeCustomer(sequelize, tablePrefix, schema);

  // NOTE: Associations are disabled in Zero-Config mode to avoid Sequelize
  // version conflicts when using file-based local dependencies.
  // Associations can be set up manually by the consuming application if needed.
  //
  // SolidusCustomer.hasMany(SolidusCharge, { foreignKey: 'customer_id' });
  // SolidusCharge.belongsTo(SolidusCustomer, { foreignKey: 'customer_id' });
  // SolidusCustomer.hasMany(SolidusSubscription, { foreignKey: 'customer_id' });
  // SolidusSubscription.belongsTo(SolidusCustomer, { foreignKey: 'customer_id' });
  // SolidusCustomer.hasMany(SolidusPaymentMethod, { foreignKey: 'customer_id' });
  // SolidusPaymentMethod.belongsTo(SolidusCustomer, { foreignKey: 'customer_id' });
  // SolidusCustomer.hasOne(SolidusStripeCustomer, { foreignKey: 'customer_id' });
  // SolidusStripeCustomer.belongsTo(SolidusCustomer, { foreignKey: 'customer_id' });

  return {
    Customer: SolidusCustomer,
    Charge: SolidusCharge,
    Subscription: SolidusSubscription,
    PaymentMethod: SolidusPaymentMethod,
    Invoice: SolidusInvoice,
    WebhookEvent: SolidusWebhookEvent,
    WebhookOutbox: SolidusWebhookOutbox,
    IdempotencyKey: SolidusIdempotencyKey,
    StripeCustomer: SolidusStripeCustomer,
  };
}
