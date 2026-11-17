import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Signed-in area. `auth.protect()` runs on the server, so signed-out visitors
 * are redirected to sign in before any page in this group renders. Data access
 * is still authorized again inside every Convex function.
 */
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  await auth.protect();
  return <AppShell>{children}</AppShell>;
}
