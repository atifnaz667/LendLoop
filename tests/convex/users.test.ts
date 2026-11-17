import { describe, expect, it } from "vitest";
import { api, internal } from "@convex/_generated/api";
import { setup, signIn } from "../helpers/convex";

describe("users: provisioning", () => {
  it("creates a profile from the verified identity with role user", async () => {
    const t = setup();
    const { as } = await signIn(t, { name: "  Ada   Lovelace ", email: "ADA@Example.com" });
    const me = await as.query(api.users.me, {});
    expect(me).toMatchObject({ name: "Ada Lovelace", role: "user", isTrustedLender: false });
    // Email is stored (normalized) but never returned by `me`.
    expect(me).not.toHaveProperty("email");
  });

  it("is idempotent: calling ensureCurrent twice keeps one profile", async () => {
    const t = setup();
    const { as, userId } = await signIn(t);
    const again = await as.mutation(api.users.ensureCurrent, {});
    expect(again).toBe(userId);
    const count = await t.run(async (ctx) => (await ctx.db.query("users").collect()).length);
    expect(count).toBe(1);
  });

  it("returns null for signed-out callers and rejects ensureCurrent", async () => {
    const t = setup();
    expect(await t.query(api.users.me, {})).toBeNull();
    await expect(t.mutation(api.users.ensureCurrent, {})).rejects.toThrow(/sign in/i);
  });
});

describe("users: RBAC", () => {
  it("lets an admin mark a trusted lender", async () => {
    const t = setup();
    const admin = await signIn(t, { role: "admin" });
    const lender = await signIn(t);
    await admin.as.mutation(api.users.setTrustedLender, { userId: lender.userId, trusted: true });
    const me = await lender.as.query(api.users.me, {});
    expect(me?.isTrustedLender).toBe(true);
  });

  it("forbids a regular user from marking trusted lenders, even themselves", async () => {
    const t = setup();
    const user = await signIn(t);
    await expect(
      user.as.mutation(api.users.setTrustedLender, { userId: user.userId, trusted: true }),
    ).rejects.toThrow(/admins/i);
  });

  it("forbids a regular user from listing members", async () => {
    const t = setup();
    const user = await signIn(t);
    await expect(user.as.query(api.users.listForAdmin, {})).rejects.toThrow(/admins only/i);
  });

  it("admin member list does not expose emails", async () => {
    const t = setup();
    const admin = await signIn(t, { role: "admin" });
    await signIn(t, { email: "private@example.com" });
    const members = await admin.as.query(api.users.listForAdmin, {});
    expect(JSON.stringify(members)).not.toContain("private@example.com");
  });

  it("only promotes roles through the internal setRole mutation", async () => {
    const t = setup();
    const user = await signIn(t, { email: "boss@example.com" });
    await t.mutation(internal.users.setRole, { email: "Boss@Example.com", role: "admin" });
    expect((await user.as.query(api.users.me, {}))?.role).toBe("admin");
  });
});

describe("users: Clerk deletion", () => {
  it("anonymizes the profile and blocks the stale session", async () => {
    const t = setup();
    const user = await signIn(t, { name: "Grace", email: "grace@example.com" });
    await t.mutation(internal.users.deleteFromClerk, { clerkUserId: user.subject });

    const row = await t.run(async (ctx) => ctx.db.get(user.userId));
    expect(row?.name).toBe("Deleted user");
    expect(row?.email).toBeUndefined();
    expect(row?.deletedAt).toBeTypeOf("number");

    expect(await user.as.query(api.users.me, {})).toBeNull();
    await expect(user.as.mutation(api.users.ensureCurrent, {})).rejects.toThrow(/deleted/i);
  });
});
