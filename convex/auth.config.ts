import type { AuthConfig } from "convex/server";

/**
 * Clerk as the Convex auth provider (official Clerk + Convex integration).
 * CLERK_FRONTEND_API_URL is set on the Convex deployment, never in code:
 *   npx convex env set CLERK_FRONTEND_API_URL https://<your-app>.clerk.accounts.dev
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
