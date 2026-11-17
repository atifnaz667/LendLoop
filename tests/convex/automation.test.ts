import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { hmacHex, signInbound } from "@convex/lib/hmac";
import { addDays, todayIso } from "@convex/lib/dates";
import { MAX_ATTEMPTS } from "@convex/services/outboxService";
import { sampleTool, setup, signIn, type TestConvex } from "../helpers/convex";

const TO_N8N = "to-n8n-test-secret";
const TO_LENDLOOP = "to-lendloop-test-secret";
const WEBHOOK_URL = "https://n8n.example.test/webhook/lendloop-request-events";

beforeEach(() => {
  process.env.N8N_REQUEST_WEBHOOK_URL = WEBHOOK_URL;
  process.env.LENDLOOP_TO_N8N_SECRET = TO_N8N;
  process.env.N8N_TO_LENDLOOP_SECRET = TO_LENDLOOP;
  // Scheduled deliveries run on fake timers so each test drives them explicitly.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.N8N_REQUEST_WEBHOOK_URL;
  delete process.env.LENDLOOP_TO_N8N_SECRET;
  delete process.env.N8N_TO_LENDLOOP_SECRET;
});

function stubFetch(status: number | "network") {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (status === "network") throw new Error("connection refused");
      return new Response("{}", { status });
    }),
  );
  return calls;
}

async function requestFlow(t: TestConvex) {
  const owner = await signIn(t, { name: "Olivia Owner", email: "olivia@example.com" });
  const borrower = await signIn(t, { name: "Ben Borrower", email: "ben@example.com" });
  const admin = await signIn(t, { role: "admin" });
  const toolId = await owner.as.mutation(api.tools.create, sampleTool);
  const requestId = await borrower.as.mutation(api.borrowRequests.create, {
    toolId,
    startDate: addDays(todayIso(), 1),
    endDate: addDays(todayIso(), 2),
  });
  return { owner, borrower, admin, toolId, requestId };
}

const deliveries = (t: TestConvex) =>
  t.run(async (ctx) => ctx.db.query("webhookDeliveries").collect());

describe("outbox: request events", () => {
  it("queues a minimized request.created event for the owner in the same transaction", async () => {
    const t = setup();
    stubFetch(200);
    await requestFlow(t);
    const [delivery] = await deliveries(t);
    expect(delivery).toMatchObject({
      eventType: "request.created",
      status: "pending",
      attempts: 0,
    });

    const payload = JSON.parse(delivery!.payload);
    expect(payload).toMatchObject({
      eventType: "request.created",
      recipient: { role: "owner", firstName: "Olivia", email: "olivia@example.com" },
      counterpart: { firstName: "Ben" },
      tool: { name: "Cordless drill" },
    });
    // Data minimization: the borrower's email and surnames are never sent for this event.
    expect(delivery!.payload).not.toContain("ben@example.com");
    expect(delivery!.payload).not.toContain("Borrower");
    expect(delivery!.payload).not.toContain('role":"admin');
  });

  it("queues events for every status change, addressed to the right person", async () => {
    const t = setup();
    stubFetch(200);
    const { owner, borrower, toolId, requestId } = await requestFlow(t);
    await owner.as.mutation(api.borrowRequests.approve, { requestId });
    await owner.as.mutation(api.borrowRequests.markReturned, { requestId });
    const second = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: addDays(todayIso(), 3),
      endDate: addDays(todayIso(), 4),
    });
    await borrower.as.mutation(api.borrowRequests.cancel, { requestId: second });

    const events = (await deliveries(t)).map((d) => {
      const p = JSON.parse(d.payload);
      return `${p.eventType}->${p.recipient.role}`;
    });
    expect(events).toEqual([
      "request.created->owner",
      "request.approved->borrower",
      "request.returned->borrower",
      "request.created->owner",
      "request.cancelled->owner",
    ]);
  });
});

describe("outbox: delivery", () => {
  it("delivers with a valid signature and marks the row delivered", async () => {
    const t = setup();
    const calls = stubFetch(200);
    await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const [delivery] = await deliveries(t);
    expect(delivery).toMatchObject({ status: "delivered", attempts: 1 });
    expect(calls).toHaveLength(1);

    const headers = calls[0]!.init.headers as Record<string, string>;
    const body = calls[0]!.init.body as string;
    expect(calls[0]!.url).toBe(WEBHOOK_URL);
    expect(headers["x-lendloop-event-id"]).toBe(delivery!.eventId);
    const expected = await hmacHex(TO_N8N, `${headers["x-lendloop-timestamp"]}.${body}`);
    expect(headers["x-lendloop-signature"]).toBe(`v1=${expected}`);
  });

  it("retries with backoff on 5xx and gives up visibly after the max attempts", async () => {
    const t = setup();
    const calls = stubFetch(503);
    await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const [delivery] = await deliveries(t);
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(delivery).toMatchObject({
      status: "failed",
      attempts: MAX_ATTEMPTS,
      lastError: "n8n responded 503",
    });
    // Every retry re-sends the same eventId, so n8n can deduplicate.
    const ids = new Set(
      calls.map((c) => (c.init.headers as Record<string, string>)["x-lendloop-event-id"]),
    );
    expect(ids.size).toBe(1);
  });

  it("retries network errors", async () => {
    const t = setup();
    const calls = stubFetch("network");
    await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect((await deliveries(t))[0]?.lastError).toMatch(/network error/);
  });

  it("does not retry a 4xx (for example a signature mismatch)", async () => {
    const t = setup();
    const calls = stubFetch(401);
    await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(calls).toHaveLength(1);
    expect((await deliveries(t))[0]).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("fails visibly, without calling out, when the integration is not configured", async () => {
    delete process.env.N8N_REQUEST_WEBHOOK_URL;
    const t = setup();
    const calls = stubFetch(200);
    await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(calls).toHaveLength(0);
    expect((await deliveries(t))[0]?.lastError).toMatch(/not set/);
  });

  it("never sends the same delivery twice concurrently (lease)", async () => {
    const t = setup();
    const calls = stubFetch(200);
    await requestFlow(t);
    const [delivery] = await deliveries(t);
    await Promise.all([
      t.action(internal.webhookDeliveries.deliver, { deliveryId: delivery!._id }),
      t.action(internal.webhookDeliveries.deliver, { deliveryId: delivery!._id }),
    ]);
    expect(calls).toHaveLength(1);
  });

  it("lets admins see failures and retry them; users cannot", async () => {
    const t = setup();
    stubFetch(401);
    const { admin, borrower } = await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const health = await admin.as.query(api.webhookDeliveries.health, {});
    expect(health.failed).toHaveLength(1);
    const deliveryId = health.failed[0]!._id as Id<"webhookDeliveries">;

    await expect(borrower.as.query(api.webhookDeliveries.health, {})).rejects.toThrow(
      /admins only/i,
    );
    await expect(borrower.as.mutation(api.webhookDeliveries.retry, { deliveryId })).rejects.toThrow(
      /admins only/i,
    );

    stubFetch(200);
    await admin.as.mutation(api.webhookDeliveries.retry, { deliveryId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await deliveries(t))[0]?.status).toBe("delivered");
  });

  it("lets admins send a waiting delivery now instead of waiting for its backoff", async () => {
    const t = setup();
    stubFetch(502);
    const { admin } = await requestFlow(t);
    const [delivery] = await deliveries(t);
    await t.action(internal.webhookDeliveries.deliver, { deliveryId: delivery!._id });

    const health = await admin.as.query(api.webhookDeliveries.health, {});
    expect(health.pending).toHaveLength(1);
    const waiting = health.pending[0]!;
    expect(waiting).toMatchObject({ attempts: 1, lastError: "n8n responded 502" });
    expect(waiting.nextAttemptAt).toBeGreaterThan(Date.now());

    const calls = stubFetch(200);
    await admin.as.mutation(api.webhookDeliveries.retry, {
      deliveryId: waiting._id as Id<"webhookDeliveries">,
    });
    // Due immediately: the attempt goes out now, not after the 30s backoff.
    await t.action(internal.webhookDeliveries.deliver, { deliveryId: delivery!._id });
    expect(calls).toHaveLength(1);
    expect((await deliveries(t))[0]?.status).toBe("delivered");
  });
});

describe("outbox: retention", () => {
  it("purges old finished deliveries but keeps recent and pending ones", async () => {
    const t = setup();
    stubFetch(200);
    await requestFlow(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const day = 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      const base = {
        eventType: "request.created" as const,
        requestId: (await ctx.db.query("borrowRequests").first())!._id,
        payload: "{}",
        attempts: 1,
      };
      await ctx.db.insert("webhookDeliveries", {
        ...base,
        eventId: "old-delivered",
        status: "delivered",
        nextAttemptAt: Date.now() - 8 * day,
      });
      await ctx.db.insert("webhookDeliveries", {
        ...base,
        eventId: "recent-failed",
        status: "failed",
        nextAttemptAt: Date.now() - 8 * day,
      });
      await ctx.db.insert("webhookDeliveries", {
        ...base,
        eventId: "old-failed",
        status: "failed",
        nextAttemptAt: Date.now() - 31 * day,
      });
    });

    await t.mutation(internal.webhookDeliveries.purgeOld, {});
    const left = (await deliveries(t)).map((d) => d.eventId);
    expect(left).toHaveLength(2);
    expect(left).toContain("recent-failed");
    expect(left).not.toContain("old-delivered");
    expect(left).not.toContain("old-failed");
  });
});

// ---------------------------------------------------------------------------
// n8n -> Convex HTTP endpoints
// ---------------------------------------------------------------------------

async function signedFetch(
  t: TestConvex,
  method: "GET" | "POST",
  path: string,
  body = "",
  opts: { secret?: string; signPath?: string; nowMs?: number } = {},
) {
  const { timestamp, signature } = await signInbound(
    opts.secret ?? TO_LENDLOOP,
    method,
    opts.signPath ?? path,
    body,
    opts.nowMs ?? Date.now(),
  );
  return t.fetch(path, {
    method,
    headers: {
      "x-lendloop-timestamp": timestamp,
      "x-lendloop-signature": signature,
      "content-type": "application/json",
    },
    ...(method === "POST" ? { body } : {}),
  });
}

async function overdueLoan(t: TestConvex) {
  const owner = await signIn(t, { name: "Olivia Owner" });
  const borrower = await signIn(t, { name: "Ben Borrower", email: "ben@example.com" });
  const toolId = await owner.as.mutation(api.tools.create, sampleTool);
  const requestId = await t.run(async (ctx) =>
    ctx.db.insert("borrowRequests", {
      toolId,
      borrowerId: borrower.userId,
      ownerId: owner.userId,
      startDate: addDays(todayIso(), -6),
      endDate: addDays(todayIso(), -2),
      status: "approved",
    }),
  );
  return { owner, borrower, requestId };
}

describe("GET /n8n/overdue-loans", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns overdue loans with only the fields a reminder needs", async () => {
    const t = setup();
    const { requestId } = await overdueLoan(t);
    const res = await signedFetch(t, "GET", "/n8n/overdue-loans");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      asOf: todayIso(),
      loans: [
        {
          requestId,
          borrower: { firstName: "Ben", email: "ben@example.com" },
          tool: { name: "Cordless drill" },
          endDate: addDays(todayIso(), -2),
          daysOverdue: 2,
          idempotencyKey: `reminder:${requestId}:${todayIso()}`,
        },
      ],
    });
    expect(JSON.stringify(data)).not.toContain("Olivia");
  });

  it("rejects unsigned, wrongly signed, stale and path-swapped requests", async () => {
    const t = setup();
    await overdueLoan(t);
    expect((await t.fetch("/n8n/overdue-loans", { method: "GET" })).status).toBe(401);
    expect((await signedFetch(t, "GET", "/n8n/overdue-loans", "", { secret: "nope" })).status).toBe(
      401,
    );
    expect(
      (
        await signedFetch(t, "GET", "/n8n/overdue-loans", "", {
          nowMs: Date.now() - 10 * 60 * 1000,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await signedFetch(t, "GET", "/n8n/overdue-loans", "", {
          signPath: "/n8n/automation-events",
        })
      ).status,
    ).toBe(401);
  });

  it("accepts the previous secret during a rotation, and only then", async () => {
    const t = setup();
    await overdueLoan(t);
    const old = "old-to-lendloop-secret";
    expect((await signedFetch(t, "GET", "/n8n/overdue-loans", "", { secret: old })).status).toBe(
      401,
    );
    process.env.N8N_TO_LENDLOOP_SECRET_PREVIOUS = old;
    try {
      expect((await signedFetch(t, "GET", "/n8n/overdue-loans", "", { secret: old })).status).toBe(
        200,
      );
      expect((await signedFetch(t, "GET", "/n8n/overdue-loans")).status).toBe(200);
    } finally {
      delete process.env.N8N_TO_LENDLOOP_SECRET_PREVIOUS;
    }
  });

  it("fails closed when the secret is not configured", async () => {
    delete process.env.N8N_TO_LENDLOOP_SECRET;
    const t = setup();
    const res = await t.fetch("/n8n/overdue-loans", { method: "GET" });
    expect(res.status).toBe(500);
  });
});

describe("POST /n8n/automation-events", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("records a reminder once, even when n8n retries", async () => {
    const t = setup();
    const { borrower, requestId } = await overdueLoan(t);
    const body = JSON.stringify({
      requestId,
      kind: "reminder_sent",
      idempotencyKey: `reminder:${requestId}:${todayIso()}`,
    });

    const first = await signedFetch(t, "POST", "/n8n/automation-events", body);
    const retry = await signedFetch(t, "POST", "/n8n/automation-events", body);
    expect(await first.json()).toEqual({ status: "created" });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ status: "duplicate" });

    const rows = await t.run(async (ctx) => ctx.db.query("automationEvents").collect());
    expect(rows).toHaveLength(1);

    // Bonus: the loan shows its automation activity in the app.
    const [mine] = await borrower.as.query(api.borrowRequests.listMine, {});
    expect(mine?.activity).toEqual([{ kind: "reminder_sent", occurredAt: expect.any(Number) }]);
  });

  it("stops listing a loan as overdue-to-remind once today's reminder is recorded", async () => {
    const t = setup();
    const { requestId } = await overdueLoan(t);
    await signedFetch(
      t,
      "POST",
      "/n8n/automation-events",
      JSON.stringify({
        requestId,
        kind: "reminder_sent",
        idempotencyKey: `reminder:${requestId}:${todayIso()}`,
      }),
    );
    const res = await signedFetch(t, "GET", "/n8n/overdue-loans");
    expect((await res.json()).loans).toEqual([]);
  });

  it("validates the payload", async () => {
    const t = setup();
    const { requestId } = await overdueLoan(t);
    const post = (payload: unknown) =>
      signedFetch(t, "POST", "/n8n/automation-events", JSON.stringify(payload));

    expect((await post({ requestId, kind: "hacked", idempotencyKey: "reminder:x" })).status).toBe(
      400,
    );
    expect(
      (await post({ requestId, kind: "reminder_sent", idempotencyKey: "drop table" })).status,
    ).toBe(400);
    expect((await post({ requestId, kind: "reminder_sent" })).status).toBe(400);
    expect((await signedFetch(t, "POST", "/n8n/automation-events", "not json")).status).toBe(400);
    expect(
      (
        await post({
          requestId: "not-a-real-id",
          kind: "reminder_sent",
          idempotencyKey: "reminder:y",
        })
      ).status,
    ).toBe(404);
  });

  it("rejects tampered bodies and oversized payloads", async () => {
    const t = setup();
    const { requestId } = await overdueLoan(t);
    const body = JSON.stringify({ requestId, kind: "reminder_sent", idempotencyKey: "reminder:z" });
    const { timestamp, signature } = await signInbound(
      TO_LENDLOOP,
      "POST",
      "/n8n/automation-events",
      body,
    );
    const tampered = await t.fetch("/n8n/automation-events", {
      method: "POST",
      headers: { "x-lendloop-timestamp": timestamp, "x-lendloop-signature": signature },
      body: body.replace("reminder_sent", "reminder_failed"),
    });
    expect(tampered.status).toBe(401);

    const huge = await signedFetch(t, "POST", "/n8n/automation-events", "x".repeat(5000));
    expect(huge.status).toBe(413);
  });
});
