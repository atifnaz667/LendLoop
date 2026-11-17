import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { vAutomationEventKind } from "./lib/validators";
import * as requestModel from "./models/requestModel";
import * as automationService from "./services/automationService";

/** Internal functions behind the signed n8n HTTP endpoints. Not callable from browsers. */

export const overdueLoans = internalQuery({
  args: {},
  handler: async (ctx) => automationService.listOverdueForReminders(ctx),
});

export const recordEvent = internalMutation({
  args: {
    requestId: v.string(),
    kind: vAutomationEventKind,
    idempotencyKey: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, ...rest }) => {
    // The id comes from an external system: validate it belongs to the right table.
    const id = requestModel.normalizeId(ctx, requestId);
    if (!id) return "not_found" as const;
    return automationService.record(ctx, { requestId: id, ...rest });
  },
});
