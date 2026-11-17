import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signOutbound, verifyInbound } from "@convex/lib/hmac";
import { runCodeNode } from "../helpers/n8n";

const TO_N8N = "to-n8n-test-secret";
const TO_LENDLOOP = "to-lendloop-test-secret";
const env = { LENDLOOP_TO_N8N_SECRET: TO_N8N, N8N_TO_LENDLOOP_SECRET: TO_LENDLOOP };

const event = {
  eventId: "4b1e7d1c-0000-4000-8000-000000000001",
  eventType: "request.created",
  occurredAt: 1_794_900_000_000,
  requestId: "req123",
  recipient: { role: "owner", firstName: "José", email: "jose@example.com" },
  counterpart: { firstName: "Ben" },
  tool: { name: "Cordless drill" },
  dates: { start: "2026-11-18", end: "2026-11-20" },
};

async function webhookItem(body: string, secret = TO_N8N, nowMs = Date.now()) {
  const { timestamp, signature } = await signOutbound(secret, body, nowMs);
  return {
    json: {
      headers: { "x-lendloop-timestamp": timestamp, "x-lendloop-signature": signature },
      body: JSON.parse(body),
    },
  };
}

describe("n8n: verify request event (Convex -> n8n)", () => {
  it("accepts an event signed by Convex, using the raw body", async () => {
    const body = JSON.stringify(event);
    const [out] = await runCodeNode("verify-request-event", {
      env,
      items: [await webhookItem(body)],
      rawBody: body,
    });
    expect(out.json).toMatchObject({
      valid: true,
      duplicate: false,
      event: { eventId: event.eventId },
    });
  });

  it("also verifies when only the parsed body is available (fallback)", async () => {
    const body = JSON.stringify(event);
    const [out] = await runCodeNode("verify-request-event", {
      env,
      items: [await webhookItem(body)],
    });
    expect(out.json.valid).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a stale timestamp", async () => {
    const body = JSON.stringify(event);
    const tampered = await runCodeNode("verify-request-event", {
      env,
      items: [await webhookItem(body)],
      rawBody: body.replace("Ben", "Eve"),
    });
    expect(tampered[0].json).toEqual({ valid: false, reason: "signature mismatch" });

    const wrongSecret = await runCodeNode("verify-request-event", {
      env,
      items: [await webhookItem(body, "attacker-secret")],
      rawBody: body,
    });
    expect(wrongSecret[0].json.valid).toBe(false);

    const stale = await runCodeNode("verify-request-event", {
      env,
      items: [await webhookItem(body, TO_N8N, Date.now() - 10 * 60 * 1000)],
      rawBody: body,
    });
    expect(stale[0].json).toEqual({ valid: false, reason: "timestamp outside tolerance" });
  });

  it("fails loudly when the secret is not configured", async () => {
    await expect(
      runCodeNode("verify-request-event", { env: {}, items: [{ json: {} }] }),
    ).rejects.toThrow(/not configured/);
  });

  it("flags an event as duplicate once it has been handled", async () => {
    const body = JSON.stringify(event);
    const staticData: Record<string, unknown> = {};
    const item = await webhookItem(body);
    const [first] = await runCodeNode("verify-request-event", {
      env,
      items: [item],
      rawBody: body,
      staticData,
    });
    await runCodeNode("mark-event-seen", {
      items: [{ json: { status: "created" } }],
      nodes: { "Send notification (mock)": { item: { json: { eventId: event.eventId } } } },
      staticData,
    });
    const [second] = await runCodeNode("verify-request-event", {
      env,
      items: [item],
      rawBody: body,
      staticData,
    });
    expect(first.json.duplicate).toBe(false);
    expect(second.json.duplicate).toBe(true);
  });
});

describe("n8n: messages", () => {
  it("builds a message for every event type with an idempotent write-back", async () => {
    for (const eventType of [
      "request.created",
      "request.approved",
      "request.declined",
      "request.cancelled",
      "request.returned",
    ]) {
      const [out] = await runCodeNode("build-notification", {
        items: [{ json: { event: { ...event, eventType } } }],
      });
      expect(out.json.subject).toBeTruthy();
      expect(out.json.text).toContain("José");
      expect(out.json.writeback).toEqual({
        requestId: "req123",
        kind: "notification_sent",
        idempotencyKey: `notification:${event.eventId}`,
      });
    }
  });

  it("explains why a request was auto-declined", async () => {
    const [out] = await runCodeNode("build-notification", {
      items: [
        { json: { event: { ...event, eventType: "request.declined", reason: "dates_taken" } } },
      ],
    });
    expect(out.json.text).toMatch(/booked by someone else/);
  });
});

describe("n8n: signing requests to Convex (n8n -> Convex)", () => {
  it("write-back signatures verify on the Convex side", async () => {
    const writeback = {
      requestId: "req123",
      kind: "reminder_sent",
      idempotencyKey: "reminder:req123:2026-11-17",
    };
    const out = await runCodeNode("sign-writeback", { env, json: { writeback } });
    const result = await verifyInbound({
      secret: TO_LENDLOOP,
      method: "POST",
      path: "/n8n/automation-events",
      body: out.json.body,
      timestamp: out.json.timestamp,
      signature: out.json.signature,
    });
    expect(result).toEqual({ ok: true });
    expect(JSON.parse(out.json.body)).toEqual(writeback);
  });

  it("overdue fetch signatures verify on the Convex side", async () => {
    const [out] = await runCodeNode("sign-overdue-fetch", { env });
    const result = await verifyInbound({
      secret: TO_LENDLOOP,
      method: "GET",
      path: "/n8n/overdue-loans",
      body: "",
      timestamp: out.json.timestamp,
      signature: out.json.signature,
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("n8n: reminders", () => {
  const loan = {
    requestId: "req9",
    borrower: { firstName: "Ben", email: "ben@example.com" },
    tool: { name: "Ladder" },
    endDate: "2026-11-14",
    daysOverdue: 3,
    idempotencyKey: "reminder:req9:2026-11-17",
  };

  it("splits loans into one item each and stops when there are none", async () => {
    const items = await runCodeNode("split-overdue-loans", {
      items: [{ json: { asOf: "2026-11-17", loans: [loan, { ...loan, requestId: "req10" }] } }],
    });
    expect(items).toHaveLength(2);
    expect(
      await runCodeNode("split-overdue-loans", { items: [{ json: { asOf: "x", loans: [] } }] }),
    ).toEqual([]);
  });

  it("produces a reminder_sent write-back with the daily idempotency key", async () => {
    const out = await runCodeNode("send-reminder-mock", { env: {}, json: loan });
    expect(out.json.writeback).toEqual({
      requestId: "req9",
      kind: "reminder_sent",
      idempotencyKey: "reminder:req9:2026-11-17",
    });
  });

  it("throws (so the failure branch runs) when there is no email or failure is simulated", async () => {
    await expect(
      runCodeNode("send-reminder-mock", {
        env: {},
        json: { ...loan, borrower: { firstName: "Ben", email: null } },
      }),
    ).rejects.toThrow(/no email/);
    await expect(
      runCodeNode("send-reminder-mock", {
        env: { LENDLOOP_SIMULATE_REMINDER_FAILURE: "true" },
        json: loan,
      }),
    ).rejects.toThrow(/Simulated/);
  });

  it("records reminder_failed with the reason", async () => {
    const out = await runCodeNode("reminder-failed", {
      json: { error: { message: "SMTP down" } },
      nodes: { "Split overdue loans": { item: { json: loan } } },
    });
    expect(out.json.writeback).toEqual({
      requestId: "req9",
      kind: "reminder_failed",
      idempotencyKey: "reminder:req9:2026-11-17:failed",
      detail: "SMTP down",
    });
  });
});

describe("n8n: exported workflows", () => {
  const dir = join(process.cwd(), "n8n/workflows");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("exports the three workflows", () => {
    expect(files.sort()).toEqual([
      "error-handler.json",
      "overdue-reminders.json",
      "request-notification.json",
    ]);
  });

  it("embed the current Code node sources (run npm run n8n:build after editing n8n/code)", () => {
    for (const file of files) {
      const wf = JSON.parse(readFileSync(join(dir, file), "utf8"));
      for (const node of wf.nodes.filter(
        (n: { type: string }) => n.type === "n8n-nodes-base.code",
      )) {
        const sources = readdirSync(join(process.cwd(), "n8n/code")).map((f) =>
          readFileSync(join(process.cwd(), "n8n/code", f), "utf8"),
        );
        expect(sources).toContain(node.parameters.jsCode);
      }
    }
  });

  it("contain no credentials and read secrets only from the environment", () => {
    for (const file of files) {
      const text = readFileSync(join(dir, file), "utf8");
      const wf = JSON.parse(text);
      expect(wf.nodes.every((n: { credentials?: unknown }) => n.credentials === undefined)).toBe(
        true,
      );
      expect(text).not.toMatch(/whsec_|sk_(test|live)_/);
      expect(text).not.toContain(TO_N8N);
    }
  });

  it("point the automation workflows at the error workflow and retry network calls", () => {
    for (const file of ["request-notification.json", "overdue-reminders.json"]) {
      const wf = JSON.parse(readFileSync(join(dir, file), "utf8"));
      expect(wf.settings.errorWorkflow).toBe("LLErrorHandler01");
      const http = wf.nodes.filter(
        (n: { type: string }) => n.type === "n8n-nodes-base.httpRequest",
      );
      expect(http.length).toBeGreaterThan(0);
      for (const node of http) expect(node.retryOnFail).toBe(true);
    }
  });
});
