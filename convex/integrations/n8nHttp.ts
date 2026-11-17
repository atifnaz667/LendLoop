import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyInbound } from "../lib/hmac";
import { AUTOMATION_EVENT_KINDS, type AutomationEventKind } from "../shared/constants";

/**
 * HTTP controllers for n8n. Every request must carry a valid HMAC signature
 * (n8n -> Convex secret) with a fresh timestamp; otherwise it is rejected
 * before any data is read. Responses never echo secrets or internal errors.
 */

const MAX_BODY_BYTES = 4 * 1024;
const IDEMPOTENCY_KEY = /^(notification|reminder):[A-Za-z0-9:_-]{1,150}$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function authenticate(request: Request, body: string) {
  const secret = process.env.N8N_TO_LENDLOOP_SECRET;
  if (!secret) {
    console.error("N8N_TO_LENDLOOP_SECRET is not set");
    return json(500, { error: "Integration not configured" });
  }
  const result = await verifyInbound({
    secret,
    method: request.method,
    path: new URL(request.url).pathname,
    body,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
  if (!result.ok) {
    console.warn(`Rejected n8n request: ${result.reason}`);
    return json(401, { error: "Invalid signature" });
  }
  return null;
}

/** GET /n8n/overdue-loans */
export const getOverdueLoans = httpAction(async (ctx, request) => {
  const denied = await authenticate(request, "");
  if (denied) return denied;
  const result = await ctx.runQuery(internal.automation.overdueLoans, {});
  return json(200, result);
});

interface EventBody {
  requestId: string;
  kind: AutomationEventKind;
  idempotencyKey: string;
  detail?: string;
}

function parseEventBody(raw: string): EventBody | string {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return "Body must be JSON";
  }
  if (typeof data !== "object" || data === null) return "Body must be an object";
  const { requestId, kind, idempotencyKey, detail } = data as Record<string, unknown>;
  if (typeof requestId !== "string" || requestId.length > 64) return "Invalid requestId";
  if (typeof kind !== "string" || !(AUTOMATION_EVENT_KINDS as readonly string[]).includes(kind)) {
    return "Invalid kind";
  }
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return "Invalid idempotencyKey";
  }
  if (detail !== undefined && (typeof detail !== "string" || detail.length > 300)) {
    return "Invalid detail";
  }
  return { requestId, kind: kind as AutomationEventKind, idempotencyKey, detail };
}

/** POST /n8n/automation-events (idempotent write-back) */
export const postAutomationEvent = httpAction(async (ctx, request) => {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json(413, { error: "Body too large" });

  const denied = await authenticate(request, body);
  if (denied) return denied;

  const parsed = parseEventBody(body);
  if (typeof parsed === "string") return json(400, { error: parsed });

  const status = await ctx.runMutation(internal.automation.recordEvent, parsed);
  if (status === "not_found") return json(404, { error: "Unknown request" });
  // 200 for both created and duplicate: a retried write-back is a success, not an error.
  return json(200, { status });
});
