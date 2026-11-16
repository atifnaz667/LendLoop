"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

const GRACE_PERIOD_MS = 8000;

/**
 * Shows a visible warning when Clerk says the user is signed in but Convex has
 * not accepted the session after a grace period. Usual causes: the Convex
 * deployment cannot be reached, or CLERK_FRONTEND_API_URL is missing or wrong
 * on the Convex deployment. Failing loudly beats a page that silently looks
 * signed out.
 */
export function BackendStatusBanner() {
  const { isSignedIn } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (!isSignedIn || isAuthenticated) return null;
  // Remounts (and so restarts the grace period) every time the mismatch begins.
  return <DelayedAlert reachable={!isLoading} />;
}

function DelayedAlert({ reachable }: { reachable: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), GRACE_PERIOD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div role="alert" className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
      <p className="mx-auto w-full max-w-5xl px-4 py-2 sm:px-6">
        {reachable
          ? "You're signed in, but the LendLoop server didn't accept your session. Please refresh, or contact the site admin if this keeps happening."
          : "We can't reach the LendLoop server right now. Retrying..."}
      </p>
    </div>
  );
}
