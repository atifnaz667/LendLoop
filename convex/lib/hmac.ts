/**
 * HMAC-SHA256 signing for the LendLoop <-> n8n integration (Web Crypto, so it
 * runs in the Convex runtime without Node).
 *
 * Headers:
 *   X-LendLoop-Timestamp: Unix seconds
 *   X-LendLoop-Signature: v1=<hex HMAC-SHA256>
 *
 * Signed strings (see docs/architecture.md, section 5):
 *   Convex -> n8n:  `${timestamp}.${rawBody}`
 *   n8n -> Convex:  `${timestamp}.${METHOD}.${path}.${rawBody}`
 */

export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const SIGNATURE_HEADER = "x-lendloop-signature";
export const EVENT_ID_HEADER = "x-lendloop-event-id";
export const SIGNATURE_VERSION = "v1";
/** Requests older or newer than this are rejected (replay protection). */
export const TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Constant-time string comparison, so timing does not leak how much of a signature matched. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const length = Math.max(ab.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export const outboundMessage = (timestamp: string, body: string) => `${timestamp}.${body}`;

export const inboundMessage = (timestamp: string, method: string, path: string, body: string) =>
  `${timestamp}.${method.toUpperCase()}.${path}.${body}`;

export async function signOutbound(secret: string, body: string, nowMs = Date.now()) {
  const timestamp = Math.floor(nowMs / 1000).toString();
  const signature = await hmacHex(secret, outboundMessage(timestamp, body));
  return { timestamp, signature: `${SIGNATURE_VERSION}=${signature}` };
}

export async function signInbound(
  secret: string,
  method: string,
  path: string,
  body: string,
  nowMs = Date.now(),
) {
  const timestamp = Math.floor(nowMs / 1000).toString();
  const signature = await hmacHex(secret, inboundMessage(timestamp, method, path, body));
  return { timestamp, signature: `${SIGNATURE_VERSION}=${signature}` };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/** Verifies an n8n -> Convex request. Never throws; returns a reason for logging. */
export async function verifyInbound(params: {
  secret: string;
  method: string;
  path: string;
  body: string;
  timestamp: string | null;
  signature: string | null;
  nowMs?: number;
}): Promise<VerifyResult> {
  const { secret, method, path, body, timestamp, signature } = params;
  if (!timestamp || !signature) return { ok: false, reason: "missing signature headers" };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "malformed timestamp" };

  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const [version, provided] = signature.split("=", 2);
  if (version !== SIGNATURE_VERSION || !provided) {
    return { ok: false, reason: "unsupported signature format" };
  }

  const expected = await hmacHex(secret, inboundMessage(timestamp, method, path, body));
  return timingSafeEqual(expected, provided.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: "signature mismatch" };
}
