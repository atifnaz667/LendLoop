import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { addDays, todayIso } from "@convex/lib/dates";
import { LIMITS } from "@convex/shared/constants";
import { sampleTool, setup, signIn, type TestConvex } from "../helpers/convex";

/** Inserts an approved loan directly (the requests module adds the real flow). */
async function approvedLoan(
  t: TestConvex,
  toolId: Id<"tools">,
  borrowerId: Id<"users">,
  startDate: string,
  endDate: string,
) {
  await t.run(async (ctx) => {
    const tool = await ctx.db.get(toolId);
    await ctx.db.insert("borrowRequests", {
      toolId,
      borrowerId,
      ownerId: tool!.ownerId,
      startDate,
      endDate,
      status: "approved",
    });
  });
}

describe("tools: create and validate", () => {
  it("caps how many tools one person can list", async () => {
    const t = setup();
    const owner = await signIn(t);
    await t.run(async (ctx) => {
      const me = await ctx.db.query("users").first();
      for (let i = 0; i < LIMITS.maxListedToolsPerOwner; i++) {
        await ctx.db.insert("tools", {
          ...sampleTool,
          name: `Tool ${i}`,
          ownerId: me!._id,
        });
      }
    });
    await expect(owner.as.mutation(api.tools.create, sampleTool)).rejects.toThrow(
      /at most 50 tools/,
    );
  });

  it("creates a listing owned by the caller with trimmed input", async () => {
    const t = setup();
    const alice = await signIn(t);
    await alice.as.mutation(api.tools.create, { ...sampleTool, name: "  Cordless   drill " });
    const mine = await alice.as.query(api.tools.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "Cordless drill", availability: "available" });
  });

  it("rejects signed-out callers", async () => {
    const t = setup();
    await expect(t.mutation(api.tools.create, sampleTool)).rejects.toThrow(/sign in/i);
  });

  it("rejects invalid input on the server", async () => {
    const t = setup();
    const alice = await signIn(t);
    await expect(alice.as.mutation(api.tools.create, { ...sampleTool, name: " " })).rejects.toThrow(
      /at least 2/,
    );
    await expect(
      alice.as.mutation(api.tools.create, { ...sampleTool, description: "x".repeat(501) }),
    ).rejects.toThrow(/at most 500/);
  });

  it("rejects categories outside the allowed list", async () => {
    const t = setup();
    const alice = await signIn(t);
    await expect(
      alice.as.mutation(api.tools.create, {
        ...sampleTool,
        category: "weapons" as unknown as "garden",
      }),
    ).rejects.toThrow();
  });
});

describe("tools: ownership rules", () => {
  it("lets the owner edit and delete their listing", async () => {
    const t = setup();
    const alice = await signIn(t);
    const toolId = await alice.as.mutation(api.tools.create, sampleTool);
    await alice.as.mutation(api.tools.update, { toolId, ...sampleTool, condition: "fair" });
    expect((await alice.as.query(api.tools.listMine, {}))[0]?.condition).toBe("fair");
    await alice.as.mutation(api.tools.remove, { toolId });
    expect(await alice.as.query(api.tools.listMine, {})).toHaveLength(0);
  });

  it("forbids editing or deleting someone else's listing, including for admins", async () => {
    const t = setup();
    const alice = await signIn(t);
    const bob = await signIn(t);
    const admin = await signIn(t, { role: "admin" });
    const toolId = await alice.as.mutation(api.tools.create, sampleTool);

    for (const actor of [bob, admin]) {
      await expect(
        actor.as.mutation(api.tools.update, { toolId, ...sampleTool, name: "Mine now" }),
      ).rejects.toThrow(/your own/);
      await expect(actor.as.mutation(api.tools.remove, { toolId })).rejects.toThrow(/your own/);
    }
  });

  it("blocks the owner from deleting a tool with an approved loan", async () => {
    const t = setup();
    const alice = await signIn(t);
    const bob = await signIn(t);
    const toolId = await alice.as.mutation(api.tools.create, sampleTool);
    await approvedLoan(t, toolId, bob.userId, todayIso(), addDays(todayIso(), 2));
    await expect(alice.as.mutation(api.tools.remove, { toolId })).rejects.toThrow(/approved loan/);
  });
});

describe("tools: admin moderation", () => {
  it("lets an admin remove any listing", async () => {
    const t = setup();
    const alice = await signIn(t);
    const admin = await signIn(t, { role: "admin" });
    const toolId = await alice.as.mutation(api.tools.create, sampleTool);
    await admin.as.mutation(api.tools.adminRemove, { toolId });
    expect(await alice.as.query(api.tools.browse, {})).toHaveLength(0);
    const row = await t.run(async (ctx) => ctx.db.get(toolId));
    expect(row?.removedBy).toBe(admin.userId);
  });

  it("forbids regular users from using admin removal", async () => {
    const t = setup();
    const alice = await signIn(t);
    const bob = await signIn(t);
    const toolId = await alice.as.mutation(api.tools.create, sampleTool);
    await expect(bob.as.mutation(api.tools.adminRemove, { toolId })).rejects.toThrow(
      /admins only/i,
    );
    await expect(alice.as.mutation(api.tools.adminRemove, { toolId })).rejects.toThrow(
      /admins only/i,
    );
  });

  it("only tells admins they can remove listings", async () => {
    const t = setup();
    const alice = await signIn(t);
    const admin = await signIn(t, { role: "admin" });
    await alice.as.mutation(api.tools.create, sampleTool);
    expect((await alice.as.query(api.tools.browse, {}))[0]?.canRemove).toBe(false);
    expect((await admin.as.query(api.tools.browse, {}))[0]?.canRemove).toBe(true);
  });
});

describe("tools: public list and browsing", () => {
  it("public list returns only name and category, and only available tools", async () => {
    const t = setup();
    const alice = await signIn(t, { email: "alice@example.com", name: "Alice Owner" });
    const bob = await signIn(t);
    await alice.as.mutation(api.tools.create, sampleTool);
    const loanedId = await alice.as.mutation(api.tools.create, {
      ...sampleTool,
      name: "Tent",
      category: "camping",
    });
    await approvedLoan(t, loanedId, bob.userId, todayIso(), addDays(todayIso(), 3));

    const list = await t.query(api.tools.listPublic, {});
    expect(list).toEqual([{ name: "Cordless drill", category: "power_tools" }]);
    const raw = JSON.stringify(list);
    expect(raw).not.toContain("alice@example.com");
    expect(raw).not.toContain("Alice Owner");
  });

  it("browse requires sign-in", async () => {
    const t = setup();
    await expect(t.query(api.tools.browse, {})).rejects.toThrow(/sign in/i);
  });

  it("filters by category and shows availability", async () => {
    const t = setup();
    const alice = await signIn(t);
    const bob = await signIn(t);
    const drill = await alice.as.mutation(api.tools.create, sampleTool);
    await alice.as.mutation(api.tools.create, { ...sampleTool, name: "Rake", category: "garden" });
    const end = addDays(todayIso(), 4);
    await approvedLoan(t, drill, bob.userId, addDays(todayIso(), -1), end);

    const garden = await bob.as.query(api.tools.browse, { category: "garden" });
    expect(garden.map((x) => x.name)).toEqual(["Rake"]);

    const all = await bob.as.query(api.tools.browse, {});
    const drillRow = all.find((x) => x.name === "Cordless drill");
    expect(drillRow).toMatchObject({ availability: "on_loan", availableFrom: end, isMine: false });
  });

  it("future loans do not mark a tool as on loan today", async () => {
    const t = setup();
    const alice = await signIn(t);
    const bob = await signIn(t);
    const toolId = await alice.as.mutation(api.tools.create, sampleTool);
    await approvedLoan(t, toolId, bob.userId, addDays(todayIso(), 5), addDays(todayIso(), 7));
    expect((await bob.as.query(api.tools.browse, {}))[0]?.availability).toBe("available");
  });

  it("shows the Trusted Lender badge but never the lender's email", async () => {
    const t = setup();
    const admin = await signIn(t, { role: "admin" });
    const alice = await signIn(t, { name: "Alice", email: "alice@example.com" });
    const bob = await signIn(t);
    await alice.as.mutation(api.tools.create, sampleTool);
    await admin.as.mutation(api.users.setTrustedLender, { userId: alice.userId, trusted: true });

    const [row] = await bob.as.query(api.tools.browse, {});
    expect(row?.lender).toEqual({ name: "Alice", isTrustedLender: true });
    expect(JSON.stringify(row)).not.toContain("alice@example.com");
  });
});
