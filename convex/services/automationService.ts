import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { daysBetween, todayIso } from "../lib/dates";
import * as automationEventModel from "../models/automationEventModel";
import * as requestModel from "../models/requestModel";
import * as toolModel from "../models/toolModel";
import * as userModel from "../models/userModel";
import type { AutomationEventKind } from "../shared/constants";
import { firstName } from "./notificationService";

/** Backs the n8n-facing HTTP endpoints. Callers have already verified the signature. */

export const reminderKey = (requestId: string, day: string) => `reminder:${requestId}:${day}`;

/**
 * Overdue loans for the daily reminder workflow. Minimal fields only. Loans
 * that already got a reminder today are excluded, so a re-run is harmless.
 */
export async function listOverdueForReminders(ctx: QueryCtx, today = todayIso()) {
  const overdue = await requestModel.listOverdue(ctx, today);
  const rows = await Promise.all(
    overdue.map(async (loan) => {
      const already = await automationEventModel.getByIdempotencyKey(
        ctx,
        reminderKey(loan._id, today),
      );
      if (already) return null;
      const [borrower, tool] = await Promise.all([
        userModel.getById(ctx, loan.borrowerId),
        toolModel.getById(ctx, loan.toolId),
      ]);
      if (!borrower || borrower.deletedAt !== undefined) return null;
      return {
        requestId: loan._id,
        borrower: { firstName: firstName(borrower.name), email: borrower.email ?? null },
        tool: { name: tool?.name ?? "a tool" },
        endDate: loan.endDate,
        daysOverdue: daysBetween(loan.endDate, today),
        idempotencyKey: reminderKey(loan._id, today),
      };
    }),
  );
  return { asOf: today, loans: rows.filter((r) => r !== null) };
}

export type RecordResult = "created" | "duplicate" | "not_found";

/**
 * Idempotent write-back. Convex mutations are serializable transactions, so
 * this check-then-insert cannot create two rows for the same key even when
 * n8n retries concurrently.
 */
export async function record(
  ctx: MutationCtx,
  input: {
    requestId: Id<"borrowRequests">;
    kind: AutomationEventKind;
    idempotencyKey: string;
    detail?: string;
  },
): Promise<RecordResult> {
  const existing = await automationEventModel.getByIdempotencyKey(ctx, input.idempotencyKey);
  if (existing) return "duplicate";
  const request = await requestModel.getById(ctx, input.requestId);
  if (!request) return "not_found";
  await automationEventModel.insert(ctx, {
    requestId: input.requestId,
    kind: input.kind,
    idempotencyKey: input.idempotencyKey,
    detail: input.detail?.slice(0, 300),
    occurredAt: Date.now(),
  });
  return "created";
}
