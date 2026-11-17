import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { coversDate, todayIso } from "../lib/dates";
import { conflict, forbidden, notFound, validation } from "../lib/errors";
import * as requestModel from "../models/requestModel";
import * as toolModel from "../models/toolModel";
import type { ToolDoc } from "../models/toolModel";
import * as userModel from "../models/userModel";
import type { UserDoc } from "../models/userModel";
import { LIMITS, type ToolCategory, type ToolCondition } from "../shared/constants";
import { canEditTool, canRemoveAnyTool, isAdmin } from "./policy";
import { declinePendingForTool } from "./requestService";

export interface ToolInput {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
}

export type Availability = "available" | "on_loan";

/** Normalizes and validates user input. Throws VALIDATION with a user-facing message. */
export function validateToolInput(input: ToolInput): ToolInput {
  const name = input.name.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  if (name.length < 2) throw validation("Tool name must be at least 2 characters.");
  if (name.length > LIMITS.toolNameMax) {
    throw validation(`Tool name must be at most ${LIMITS.toolNameMax} characters.`);
  }
  if (description.length < 5) throw validation("Add a short description (at least 5 characters).");
  if (description.length > LIMITS.toolDescriptionMax) {
    throw validation(`Description must be at most ${LIMITS.toolDescriptionMax} characters.`);
  }
  return { ...input, name, description };
}

/** A tool is on loan when an approved request covers today. */
async function getAvailability(ctx: QueryCtx, toolId: Id<"tools">, today: string) {
  const approved = await requestModel.listByToolAndStatus(ctx, toolId, "approved");
  const current = approved.find((loan) => coversDate(loan, today));
  return {
    availability: (current ? "on_loan" : "available") as Availability,
    availableFrom: current?.endDate,
  };
}

async function requireTool(ctx: QueryCtx, toolId: Id<"tools">): Promise<ToolDoc> {
  const tool = await toolModel.getById(ctx, toolId);
  if (!tool || tool.removedAt !== undefined) throw notFound("Tool");
  return tool;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Public, unauthenticated list. Data minimization: name and category only,
 * no ids, owners, descriptions or availability details.
 */
export async function listPublic(ctx: QueryCtx) {
  const today = todayIso();
  const tools = await toolModel.listListed(ctx);
  const withStatus = await Promise.all(
    tools.map(async (tool) => ({ tool, ...(await getAvailability(ctx, tool._id, today)) })),
  );
  return withStatus
    .filter((t) => t.availability === "available")
    .map(({ tool }) => ({ name: tool.name, category: tool.category }));
}

/** Signed-in browse view with availability and the lender's public profile. */
export async function browse(ctx: QueryCtx, actor: UserDoc, category?: ToolCategory) {
  const today = todayIso();
  const tools = await toolModel.listListed(ctx, category);
  const owners = await userModel.getManyByIds(
    ctx,
    tools.map((t) => t.ownerId),
  );

  return Promise.all(
    tools.map(async (tool) => {
      const owner = owners.get(tool.ownerId);
      return {
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        ...(await getAvailability(ctx, tool._id, today)),
        // Only a display name and the trust badge. No email or contact details.
        lender: {
          name: owner?.name ?? "Neighbor",
          isTrustedLender: owner?.isTrustedLender ?? false,
        },
        isMine: tool.ownerId === actor._id,
        canRemove: canRemoveAnyTool(actor),
      };
    }),
  );
}

export async function getForViewer(ctx: QueryCtx, actor: UserDoc, toolId: Id<"tools">) {
  const tool = await toolModel.getById(ctx, toolId);
  if (!tool || tool.removedAt !== undefined) return null;
  const owner = await userModel.getById(ctx, tool.ownerId);
  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
    ...(await getAvailability(ctx, tool._id, todayIso())),
    lender: { name: owner?.name ?? "Neighbor", isTrustedLender: owner?.isTrustedLender ?? false },
    isMine: tool.ownerId === actor._id,
  };
}

export async function listMine(ctx: QueryCtx, actor: UserDoc) {
  const today = todayIso();
  const tools = await toolModel.listListedByOwner(ctx, actor._id);
  return Promise.all(
    tools.map(async (tool) => ({
      _id: tool._id,
      name: tool.name,
      category: tool.category,
      condition: tool.condition,
      description: tool.description,
      ...(await getAvailability(ctx, tool._id, today)),
    })),
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function create(ctx: MutationCtx, actor: UserDoc, input: ToolInput) {
  const clean = validateToolInput(input);
  return toolModel.insert(ctx, { ...clean, ownerId: actor._id });
}

export async function update(
  ctx: MutationCtx,
  actor: UserDoc,
  toolId: Id<"tools">,
  input: ToolInput,
) {
  const tool = await requireTool(ctx, toolId);
  if (!canEditTool(actor, tool)) throw forbidden("You can only edit your own listings.");
  await toolModel.patch(ctx, toolId, validateToolInput(input));
}

async function assertNotOnActiveLoan(ctx: QueryCtx, toolId: Id<"tools">) {
  const approved = await requestModel.listByToolAndStatus(ctx, toolId, "approved");
  if (approved.length > 0) {
    throw conflict(
      "This tool has an approved loan. Mark it as returned before removing the listing.",
    );
  }
}

/** Owner deletes their own listing (soft delete keeps loan history readable). */
export async function removeOwn(ctx: MutationCtx, actor: UserDoc, toolId: Id<"tools">) {
  const tool = await requireTool(ctx, toolId);
  if (!canEditTool(actor, tool)) throw forbidden("You can only delete your own listings.");
  await assertNotOnActiveLoan(ctx, toolId);
  await toolModel.patch(ctx, toolId, { removedAt: Date.now(), removedBy: actor._id });
  await declinePendingForTool(ctx, toolId);
}

/**
 * Admin moderation: remove any listing. Allowed even during a loan, because
 * moderation (for example an unsafe item) must not be blocked by a borrower.
 */
export async function adminRemove(ctx: MutationCtx, actor: UserDoc, toolId: Id<"tools">) {
  if (!isAdmin(actor)) throw forbidden("Admins only.");
  await requireTool(ctx, toolId);
  await toolModel.patch(ctx, toolId, { removedAt: Date.now(), removedBy: actor._id });
  await declinePendingForTool(ctx, toolId);
}
