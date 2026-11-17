import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { addDays, todayIso } from "@convex/lib/dates";
import { LIMITS } from "@convex/shared/constants";
import { sampleTool, setup, signIn, type TestConvex } from "../helpers/convex";

const today = todayIso();
const days = (n: number) => addDays(today, n);

async function world(t: TestConvex) {
  const owner = await signIn(t, { name: "Olivia Owner" });
  const borrower = await signIn(t, { name: "Ben Borrower" });
  const stranger = await signIn(t, { name: "Sam Stranger" });
  const admin = await signIn(t, { role: "admin" });
  const toolId = await owner.as.mutation(api.tools.create, sampleTool);
  return { owner, borrower, stranger, admin, toolId };
}

describe("borrow requests: creating", () => {
  it("creates a pending request visible to both parties", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await world(t);
    await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(3),
      message: "  For a shelf  ",
    });
    const mine = await borrower.as.query(api.borrowRequests.listMine, {});
    expect(mine[0]).toMatchObject({
      status: "pending",
      toolName: "Cordless drill",
      message: "For a shelf",
    });
    expect(mine[0]?.lender.name).toBe("Olivia Owner");
    const incoming = await owner.as.query(api.borrowRequests.listIncoming, {});
    expect(incoming[0]?.borrower.name).toBe("Ben Borrower");
  });

  it("does not leak email addresses in request views", async () => {
    const t = setup();
    const owner = await signIn(t, { email: "owner@example.com" });
    const borrower = await signIn(t, { email: "borrower@example.com" });
    const toolId = await owner.as.mutation(api.tools.create, sampleTool);
    await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(2),
    });
    const views = JSON.stringify([
      await owner.as.query(api.borrowRequests.listIncoming, {}),
      await borrower.as.query(api.borrowRequests.listMine, {}),
    ]);
    expect(views).not.toContain("@example.com");
  });

  it("rejects borrowing your own tool", async () => {
    const t = setup();
    const { owner, toolId } = await world(t);
    await expect(
      owner.as.mutation(api.borrowRequests.create, {
        toolId,
        startDate: days(1),
        endDate: days(2),
      }),
    ).rejects.toThrow(/your own tool/);
  });

  it("enforces date rules on the server", async () => {
    const t = setup();
    const { borrower, toolId } = await world(t);
    const attempt = (startDate: string, endDate: string) =>
      borrower.as.mutation(api.borrowRequests.create, { toolId, startDate, endDate });
    await expect(attempt(days(-1), days(1))).rejects.toThrow(/past/);
    await expect(attempt(days(3), days(1))).rejects.toThrow(/on or after/);
    await expect(attempt(days(1), days(40))).rejects.toThrow(/at most 30 days/);
    await expect(attempt(days(200), days(201))).rejects.toThrow(/days ahead/);
    await expect(attempt("2026-02-30", "2026-03-01")).rejects.toThrow(/valid calendar/);
  });

  it("rejects dates that overlap an approved loan", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await world(t);
    const id = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(5),
    });
    await owner.as.mutation(api.borrowRequests.approve, { requestId: id });
    await expect(
      stranger.as.mutation(api.borrowRequests.create, {
        toolId,
        startDate: days(5),
        endDate: days(6),
      }),
    ).rejects.toThrow(/already booked/);
    // Right after the loan ends is fine.
    await stranger.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(6),
      endDate: days(7),
    });
  });

  it("rejects duplicate pending requests from the same borrower", async () => {
    const t = setup();
    const { borrower, toolId } = await world(t);
    await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(3),
    });
    await expect(
      borrower.as.mutation(api.borrowRequests.create, {
        toolId,
        startDate: days(2),
        endDate: days(4),
      }),
    ).rejects.toThrow(/already have a pending/);
  });

  it("caps how many pending requests one borrower can have", async () => {
    const t = setup();
    const { owner, borrower } = await world(t);
    const toolIds = [];
    for (let i = 0; i <= LIMITS.maxPendingRequestsPerBorrower; i++) {
      toolIds.push(await owner.as.mutation(api.tools.create, { ...sampleTool, name: `Tool ${i}` }));
    }
    for (const toolId of toolIds.slice(0, -1)) {
      await borrower.as.mutation(api.borrowRequests.create, {
        toolId,
        startDate: days(1),
        endDate: days(2),
      });
    }
    await expect(
      borrower.as.mutation(api.borrowRequests.create, {
        toolId: toolIds.at(-1)!,
        startDate: days(1),
        endDate: days(2),
      }),
    ).rejects.toThrow(/at most 10 pending/);
  });
});

describe("borrow requests: decisions and RBAC", () => {
  it("only the owner can approve or decline", async () => {
    const t = setup();
    const { borrower, stranger, admin, toolId } = await world(t);
    const requestId = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(2),
    });
    for (const actor of [borrower, stranger, admin]) {
      await expect(actor.as.mutation(api.borrowRequests.approve, { requestId })).rejects.toThrow(
        /owner/,
      );
      await expect(actor.as.mutation(api.borrowRequests.decline, { requestId })).rejects.toThrow(
        /owner/,
      );
    }
  });

  it("approving auto-declines overlapping pending requests", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await world(t);
    const first = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(4),
    });
    await stranger.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(3),
      endDate: days(5),
    });
    await stranger.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(10),
      endDate: days(11),
    });

    const { autoDeclined } = await owner.as.mutation(api.borrowRequests.approve, {
      requestId: first,
    });
    expect(autoDeclined).toHaveLength(1);

    const strangerRows = await stranger.as.query(api.borrowRequests.listMine, {});
    expect(strangerRows.map((r) => r.status).sort()).toEqual(["declined", "pending"]);
  });

  it("follows the state machine", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await world(t);
    const requestId = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(2),
    });
    await expect(owner.as.mutation(api.borrowRequests.markReturned, { requestId })).rejects.toThrow(
      /active loans/,
    );
    await owner.as.mutation(api.borrowRequests.decline, { requestId });
    await expect(owner.as.mutation(api.borrowRequests.approve, { requestId })).rejects.toThrow(
      /pending/,
    );
    await expect(borrower.as.mutation(api.borrowRequests.cancel, { requestId })).rejects.toThrow(
      /pending/,
    );
  });

  it("only the borrower can cancel a pending request", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await world(t);
    const requestId = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(2),
    });
    for (const actor of [owner, stranger]) {
      await expect(actor.as.mutation(api.borrowRequests.cancel, { requestId })).rejects.toThrow(
        /your own requests/,
      );
    }
    await borrower.as.mutation(api.borrowRequests.cancel, { requestId });
    expect((await borrower.as.query(api.borrowRequests.listMine, {}))[0]?.status).toBe("cancelled");
  });

  it("only the owner marks a loan returned, and the tool becomes available", async () => {
    const t = setup();
    const { owner, borrower, stranger, toolId } = await world(t);
    const requestId = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: today,
      endDate: days(2),
    });
    await owner.as.mutation(api.borrowRequests.approve, { requestId });
    expect((await stranger.as.query(api.tools.browse, {}))[0]?.availability).toBe("on_loan");

    for (const actor of [borrower, stranger]) {
      await expect(
        actor.as.mutation(api.borrowRequests.markReturned, { requestId }),
      ).rejects.toThrow(/owner/);
    }
    await owner.as.mutation(api.borrowRequests.markReturned, { requestId });
    expect((await stranger.as.query(api.tools.browse, {}))[0]?.availability).toBe("available");
    await expect(owner.as.mutation(api.borrowRequests.markReturned, { requestId })).rejects.toThrow(
      /active loans/,
    );
  });

  it("removing a listing declines its pending requests", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await world(t);
    await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(2),
    });
    await owner.as.mutation(api.tools.remove, { toolId });
    const [row] = await borrower.as.query(api.borrowRequests.listMine, {});
    expect(row).toMatchObject({ status: "declined", toolRemoved: true });
  });
});

describe("borrow requests: admin view and overdue", () => {
  it("admins see all loans; users cannot", async () => {
    const t = setup();
    const { owner, borrower, stranger, admin, toolId } = await world(t);
    const requestId = await borrower.as.mutation(api.borrowRequests.create, {
      toolId,
      startDate: days(1),
      endDate: days(2),
    });
    await owner.as.mutation(api.borrowRequests.approve, { requestId });
    const loans = await admin.as.query(api.borrowRequests.listAllLoans, {});
    expect(loans).toHaveLength(1);
    await expect(stranger.as.query(api.borrowRequests.listAllLoans, {})).rejects.toThrow(
      /admins only/i,
    );
  });

  it("flags approved loans past their end date as overdue", async () => {
    const t = setup();
    const { owner, borrower, toolId } = await world(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("borrowRequests", {
        toolId,
        borrowerId: borrower.userId,
        ownerId: owner.userId,
        startDate: days(-5),
        endDate: days(-1),
        status: "approved",
      });
    });
    const [row] = await owner.as.query(api.borrowRequests.listIncoming, {});
    expect(row?.isOverdue).toBe(true);
  });
});
