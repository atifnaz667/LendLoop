import type { MutationCtx } from "../_generated/server";
import * as toolModel from "../models/toolModel";
import * as userModel from "../models/userModel";
import type { RequestDoc } from "../models/requestModel";
import type { RequestEventType } from "../shared/constants";
import { enqueue } from "./outboxService";

/**
 * Builds request events for n8n with data minimization in mind: the workflow
 * gets the recipient's first name and email (needed to notify them), the
 * other party's first name, the tool name and the dates. Nothing else: no
 * user ids, roles, addresses, or the other party's email.
 */

/** Who should hear about each event. */
const RECIPIENT: Record<RequestEventType, "owner" | "borrower"> = {
  "request.created": "owner",
  "request.cancelled": "owner",
  "request.approved": "borrower",
  "request.declined": "borrower",
  "request.returned": "borrower",
};

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Neighbor";

export async function notifyRequestEvent(
  ctx: MutationCtx,
  request: Pick<RequestDoc, "_id" | "toolId" | "ownerId" | "borrowerId" | "startDate" | "endDate">,
  eventType: RequestEventType,
  reason?: "listing_removed" | "dates_taken",
) {
  const [tool, owner, borrower] = await Promise.all([
    toolModel.getById(ctx, request.toolId),
    userModel.getById(ctx, request.ownerId),
    userModel.getById(ctx, request.borrowerId),
  ]);
  const recipientRole = RECIPIENT[eventType];
  const recipient = recipientRole === "owner" ? owner : borrower;
  const counterpart = recipientRole === "owner" ? borrower : owner;
  // Deleted accounts have no email and should not be contacted.
  if (!recipient || recipient.deletedAt !== undefined) return null;

  return enqueue(ctx, {
    eventType,
    requestId: request._id,
    body: {
      requestId: request._id,
      recipient: {
        role: recipientRole,
        firstName: firstName(recipient.name),
        email: recipient.email ?? null,
      },
      counterpart: { firstName: firstName(counterpart?.name ?? "Neighbor") },
      tool: { name: tool?.name ?? "a tool" },
      dates: { start: request.startDate, end: request.endDate },
      ...(reason ? { reason } : {}),
    },
  });
}
