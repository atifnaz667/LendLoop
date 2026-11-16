import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk proxy (Next.js 16 renamed `middleware.ts` to `proxy.ts`).
 *
 * It attaches the Clerk session to every request so server components and
 * route handlers can call `auth()`. Following current Clerk guidance, we do
 * not gate by path here. Access is enforced where the data lives:
 *   1. The `(app)` route group layout calls `auth.protect()` (server side).
 *   2. Every Convex query and mutation checks identity and role itself.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
