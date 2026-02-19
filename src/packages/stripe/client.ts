import Stripe from "stripe";
import { ConfigurationError } from "../core/errors.ts";

export interface StripeClientConfig {
  secretKey: string;
  apiVersion?: Stripe.LatestApiVersion;
  maxNetworkRetries?: number;
}

export function createStripeClient(config: StripeClientConfig): Stripe {
  const secretKey = config.secretKey.trim();

  if (secretKey.length === 0) {
    throw new ConfigurationError("Stripe secret key is required.");
  }

  return new Stripe(secretKey, {
    apiVersion: config.apiVersion,
    maxNetworkRetries: config.maxNetworkRetries ?? 2,
  });
}
