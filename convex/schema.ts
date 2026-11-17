import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAutomationEventKind,
  vRequestEventType,
  vIsoDate,
  vRequestStatus,
  vRole,
  vToolCategory,
  vToolCondition,
} from "./lib/validators";

/**
 * Data model. Every table is only touched through its model in convex/models.
 * Data minimization: we store the smallest set of user fields the features need
 * (display name and email for notifications), nothing else from Clerk.
 */
export default defineSchema({
  users: defineTable({
    /** Clerk user id (the JWT `subject`). */
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.string(),
    role: vRole,
    isTrustedLender: v.boolean(),
    /** Set when the Clerk account is deleted. Personal fields are cleared at the same time. */
    deletedAt: v.optional(v.number()),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: vToolCategory,
    condition: vToolCondition,
    description: v.string(),
    /** Soft delete keeps loan history readable after a listing is removed. */
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
  })
    .index("by_owner", ["ownerId"])
    .index("by_removedAt_category", ["removedAt", "category"]),

  borrowRequests: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    /** Denormalized from the tool so "Incoming requests" is a single indexed read. */
    ownerId: v.id("users"),
    startDate: vIsoDate,
    endDate: vIsoDate,
    status: vRequestStatus,
    message: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
  })
    .index("by_borrower", ["borrowerId"])
    .index("by_owner", ["ownerId"])
    .index("by_tool_status", ["toolId", "status"])
    .index("by_status_endDate", ["status", "endDate"]),

  /**
   * Transactional outbox for Convex -> n8n webhooks. Rows are written in the
   * same mutation as the state change, then delivered by a scheduled action
   * with retries, so a notification is never lost if n8n is down.
   */
  webhookDeliveries: defineTable({
    eventId: v.string(),
    eventType: vRequestEventType,
    requestId: v.id("borrowRequests"),
    /** Exact JSON body that is signed and sent. Contains only minimized fields. */
    payload: v.string(),
    status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_status_nextAttemptAt", ["status", "nextAttemptAt"]),

  /**
   * Automation activity per loan, written back by n8n. `idempotencyKey` is
   * unique per logical event so retried write-backs never create duplicates.
   */
  automationEvents: defineTable({
    requestId: v.id("borrowRequests"),
    kind: vAutomationEventKind,
    idempotencyKey: v.string(),
    detail: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_request", ["requestId"]),
});
