"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";

type CurrentUser = NonNullable<FunctionReturnType<typeof api.users.me>>;

type CurrentUserState =
  | { status: "loading"; user: null; error: null }
  | { status: "ready"; user: CurrentUser; error: null }
  | { status: "error"; user: null; error: string };

const CurrentUserContext = createContext<CurrentUserState | null>(null);

/**
 * Resolves the signed-in user's LendLoop profile once for the whole signed-in
 * area. It waits until Convex has accepted the Clerk session, provisions the
 * profile (idempotent), and only then reports "ready". Pages render their data
 * queries only when ready, so no query runs before auth is established or
 * after sign-out (which previously surfaced UNAUTHENTICATED errors).
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const [error, setError] = useState<string | null>(null);
  const provisionedFor = useRef<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset on sign-out so the next user that signs in gets provisioned too.
      provisionedFor.current = false;
      return;
    }
    if (provisionedFor.current) return;
    provisionedFor.current = true;
    ensureCurrent().catch((e: unknown) => setError(getErrorMessage(e)));
  }, [isAuthenticated, ensureCurrent]);

  let state: CurrentUserState;
  if (error) state = { status: "error", user: null, error };
  else if (isAuthenticated && me) state = { status: "ready", user: me, error: null };
  else state = { status: "loading", user: null, error: null };

  return <CurrentUserContext.Provider value={state}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserState {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return value;
}
