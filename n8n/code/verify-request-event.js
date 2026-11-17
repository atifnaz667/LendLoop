// Verifies the HMAC signature on a request event from LendLoop (Convex) and
// deduplicates by eventId. Secret comes from the container environment.
// Signed string: `${timestamp}.${rawBody}`, header "v1=<hex HMAC-SHA256>".
const crypto = require("crypto");

const TOLERANCE_SECONDS = 300;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const secret = $env.LENDLOOP_TO_N8N_SECRET;
if (!secret) throw new Error("LENDLOOP_TO_N8N_SECRET is not configured in the n8n environment");

const item = $input.first();
const headers = item.json.headers || {};
const timestamp = String(headers["x-lendloop-timestamp"] || "");
const signatureHeader = String(headers["x-lendloop-signature"] || "");

// Prefer the exact raw body (Webhook node "Raw Body" option). Fall back to
// re-serializing the parsed JSON, which matches what Convex sends.
let rawBody;
try {
  rawBody = (await this.helpers.getBinaryDataBuffer(0, "data")).toString("utf8");
} catch {
  rawBody = JSON.stringify(item.json.body);
}

function reject(reason) {
  return [{ json: { valid: false, reason } }];
}

if (!/^\d{1,12}$/.test(timestamp) || !signatureHeader.startsWith("v1=")) {
  return reject("missing or malformed signature headers");
}
const nowSeconds = Math.floor(Date.now() / 1000);
if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) {
  return reject("timestamp outside tolerance");
}

const expected = crypto
  .createHmac("sha256", secret)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");
const provided = signatureHeader.slice(3).toLowerCase();
const a = Buffer.from(expected, "utf8");
const b = Buffer.from(provided, "utf8");
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return reject("signature mismatch");
}

const event = JSON.parse(rawBody);

// Deduplicate retries from LendLoop (same eventId). Static data persists for
// active (production) executions.
const staticData = $getWorkflowStaticData("global");
const seen = staticData.seenEventIds || {};
const now = Date.now();
for (const [id, at] of Object.entries(seen)) {
  if (now - at > DEDUPE_WINDOW_MS) delete seen[id];
}
staticData.seenEventIds = seen;

return [{ json: { valid: true, duplicate: Boolean(seen[event.eventId]), event } }];
