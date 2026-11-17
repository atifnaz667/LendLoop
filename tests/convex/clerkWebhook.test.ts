import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setup } from "../helpers/convex";

// Test-only secret (svix format: whsec_ + base64). Not a real credential.
const SECRET = `whsec_${btoa("lendloop-test-secret-0123456789ab")}`;

function signedRequest(body: object, secret = SECRET, timestamp = new Date()) {
  const payload = JSON.stringify(body);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const signature = new Webhook(secret).sign(id, timestamp, payload);
  return {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature,
      "content-type": "application/json",
    },
    body: payload,
  };
}

const userCreated = {
  type: "user.created",
  data: {
    id: "user_clerk_1",
    first_name: "Lin",
    last_name: "Neighbor",
    primary_email_address_id: "em_1",
    email_addresses: [
      { id: "em_0", email_address: "old@example.com" },
      { id: "em_1", email_address: "Lin@Example.com" },
    ],
  },
};

describe("POST /clerk/webhook", () => {
  beforeEach(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  });

  it("creates the user from a correctly signed event, keeping only needed fields", async () => {
    const t = setup();
    const res = await t.fetch("/clerk/webhook", signedRequest(userCreated));
    expect(res.status).toBe(200);
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      clerkUserId: "user_clerk_1",
      name: "Lin Neighbor",
      email: "lin@example.com",
      role: "user",
    });
  });

  it("is idempotent when Clerk retries the same event", async () => {
    const t = setup();
    await t.fetch("/clerk/webhook", signedRequest(userCreated));
    await t.fetch("/clerk/webhook", signedRequest(userCreated));
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  it("rejects a bad signature without touching the database", async () => {
    const t = setup();
    const wrongSecret = `whsec_${btoa("some-other-secret-0123456789abcd")}`;
    const res = await t.fetch("/clerk/webhook", signedRequest(userCreated, wrongSecret));
    expect(res.status).toBe(401);
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  it("rejects a tampered body", async () => {
    const t = setup();
    const req = signedRequest(userCreated);
    req.body = req.body.replace("Lin", "Eve");
    const res = await t.fetch("/clerk/webhook", req);
    expect(res.status).toBe(401);
  });

  it("rejects a replayed event outside the timestamp window", async () => {
    const t = setup();
    const old = new Date(Date.now() - 10 * 60 * 1000);
    const res = await t.fetch("/clerk/webhook", signedRequest(userCreated, SECRET, old));
    expect(res.status).toBe(401);
  });

  it("rejects requests with no signature headers", async () => {
    const t = setup();
    const res = await t.fetch("/clerk/webhook", {
      method: "POST",
      body: JSON.stringify(userCreated),
    });
    expect(res.status).toBe(401);
  });

  it("anonymizes the user on user.deleted", async () => {
    const t = setup();
    await t.fetch("/clerk/webhook", signedRequest(userCreated));
    const res = await t.fetch(
      "/clerk/webhook",
      signedRequest({ type: "user.deleted", data: { id: "user_clerk_1", deleted: true } }),
    );
    expect(res.status).toBe(200);
    const [user] = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(user?.name).toBe("Deleted user");
    expect(user?.email).toBeUndefined();
  });

  it("fails closed when the signing secret is not configured", async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const t = setup();
    const res = await t.fetch("/clerk/webhook", signedRequest(userCreated));
    expect(res.status).toBe(500);
  });
});
