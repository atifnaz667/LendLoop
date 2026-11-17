import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hmacHex,
  inboundMessage,
  signInbound,
  signOutbound,
  timingSafeEqual,
  verifyInbound,
} from "@convex/lib/hmac";

const SECRET = "test-secret-not-real";

describe("hmac", () => {
  it("matches Node's HMAC-SHA256 (same algorithm n8n uses)", async () => {
    const message = '1700000000.{"a":1}';
    const expected = createHmac("sha256", SECRET).update(message).digest("hex");
    expect(await hmacHex(SECRET, message)).toBe(expected);
  });

  it("signs outbound events over timestamp and raw body", async () => {
    const now = Date.parse("2026-11-17T09:00:00Z");
    const { timestamp, signature } = await signOutbound(SECRET, '{"eventId":"e1"}', now);
    expect(timestamp).toBe(String(now / 1000));
    const expected = createHmac("sha256", SECRET)
      .update(`${timestamp}.{"eventId":"e1"}`)
      .digest("hex");
    expect(signature).toBe(`v1=${expected}`);
  });

  it("compares in constant time and handles different lengths", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("verifyInbound", () => {
  const now = Date.parse("2026-11-17T09:00:00Z");
  const body = '{"requestId":"r1"}';

  async function signed(overrides: Partial<Parameters<typeof verifyInbound>[0]> = {}) {
    const { timestamp, signature } = await signInbound(
      SECRET,
      "POST",
      "/n8n/automation-events",
      body,
      now,
    );
    return verifyInbound({
      secret: SECRET,
      method: "POST",
      path: "/n8n/automation-events",
      body,
      timestamp,
      signature,
      nowMs: now,
      ...overrides,
    });
  }

  it("accepts a valid signature", async () => {
    expect(await signed()).toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    expect(await signed({ body: '{"requestId":"r2"}' })).toMatchObject({
      ok: false,
      reason: "signature mismatch",
    });
  });

  it("binds the signature to method and path", async () => {
    expect(await signed({ path: "/n8n/overdue-loans" })).toMatchObject({ ok: false });
    expect(await signed({ method: "GET" })).toMatchObject({ ok: false });
  });

  it("rejects the wrong secret", async () => {
    expect(await signed({ secret: "another-secret" })).toMatchObject({ ok: false });
  });

  it("rejects replays outside the 5 minute window, in both directions", async () => {
    expect(await signed({ nowMs: now + 301_000 })).toMatchObject({
      reason: "timestamp outside tolerance",
    });
    expect(await signed({ nowMs: now - 301_000 })).toMatchObject({
      reason: "timestamp outside tolerance",
    });
    expect(await signed({ nowMs: now + 299_000 })).toEqual({ ok: true });
  });

  it("rejects missing or malformed headers", async () => {
    expect(await signed({ signature: null })).toMatchObject({
      reason: "missing signature headers",
    });
    expect(await signed({ timestamp: "abc" })).toMatchObject({ reason: "malformed timestamp" });
    expect(await signed({ signature: "v2=abc" })).toMatchObject({
      reason: "unsupported signature format",
    });
  });

  it("uses the documented canonical string", () => {
    expect(inboundMessage("1", "post", "/p", "b")).toBe("1.POST./p.b");
  });
});
