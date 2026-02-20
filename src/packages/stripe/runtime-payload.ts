const utf8Decoder = new TextDecoder();

export function toStripeWebhookPayload(payload: string | Uint8Array): string {
  if (typeof payload === "string") {
    return payload;
  }

  return utf8Decoder.decode(payload);
}
