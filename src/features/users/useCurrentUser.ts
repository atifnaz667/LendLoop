"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";

/**
 * Returns the caller's LendLoop profile. On the first authenticated render it
 * provisions the profile from the verified Clerk token (idempotent upsert).
 */
export function useCurrentUser() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || requested.current) return;
    requested.current = true;
    ensureCurrent().catch((e: unknown) => setError(getErrorMessage(e)));
  }, [isAuthenticated, ensureCurrent]);

  return {
    user: me ?? null,
    isLoading: authLoading || (isAuthenticated && me === undefined) || (me === null && !error),
    error,
  };
}
