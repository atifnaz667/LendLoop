import { EVENT_ID_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER, signOutbound } from "../lib/hmac";

/**
 * Sends one signed event to the n8n webhook. Pure I/O: the caller (the
 * deliver action) decides what to record. Returns whether a failure is worth
 * retrying (network errors, timeouts, 5xx, 429) or not (4xx = our bug or a
 * signature mismatch, retrying would not help).
 */

const TIMEOUT_MS = 10_000;

export type DispatchResult = { ok: true } | { ok: false; error: string; retryable: boolean };

export async function dispatchToN8n(
  config: { url: string | undefined; secret: string | undefined },
  event: { eventId: string; payload: string },
): Promise<DispatchResult> {
  if (!config.url || !config.secret) {
    return {
      ok: false,
      retryable: false,
      error:
        "N8N_REQUEST_WEBHOOK_URL or LENDLOOP_TO_N8N_SECRET is not set on the Convex deployment",
    };
  }

  const { timestamp, signature } = await signOutbound(config.secret, event.payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TIMESTAMP_HEADER]: timestamp,
        [SIGNATURE_HEADER]: signature,
        [EVENT_ID_HEADER]: event.eventId,
      },
      body: event.payload,
      signal: controller.signal,
    });
    if (response.ok) return { ok: true };
    const retryable = response.status >= 500 || response.status === 429;
    return { ok: false, retryable, error: `n8n responded ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, retryable: true, error: `network error: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}
