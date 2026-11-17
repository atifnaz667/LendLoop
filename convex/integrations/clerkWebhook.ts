import { Webhook, WebhookVerificationError } from "svix";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

/**
 * POST /clerk/webhook
 *
 * Keeps user profiles in sync with Clerk. The request is verified with Svix
 * (HMAC signature over id + timestamp + body, 5 minute timestamp tolerance)
 * BEFORE the body is parsed or trusted. Only the fields we store are extracted.
 */

interface ClerkEmail {
  id: string;
  email_address: string;
}
interface ClerkUserData {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmail[];
}
interface ClerkEvent {
  type: string;
  data: ClerkUserData;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export function extractUserFields(data: ClerkUserData) {
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || undefined;
  const primary = data.email_addresses?.find((e) => e.id === data.primary_email_address_id);
  return { name: name ?? undefined, email: primary?.email_address };
}

export const handleClerkWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
    return json(500, { error: "Webhook not configured" });
  }

  const svixHeaders = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };
  const payload = await request.text();

  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(payload, svixHeaders) as ClerkEvent;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return json(401, { error: "Invalid signature" });
    }
    throw error;
  }

  const clerkUserId = event.data?.id;
  if (!clerkUserId) return json(400, { error: "Missing user id" });

  switch (event.type) {
    case "user.created":
    case "user.updated":
      await ctx.runMutation(internal.users.syncFromClerk, {
        clerkUserId,
        ...extractUserFields(event.data),
      });
      break;
    case "user.deleted":
      await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
      break;
    default:
      // Acknowledge events we don't subscribe to so Clerk does not retry them.
      break;
  }
  return json(200, { ok: true });
});
