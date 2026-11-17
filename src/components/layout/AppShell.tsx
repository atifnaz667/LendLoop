"use client";

import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/ui/Alert";
import { AppNav } from "@/components/layout/AppNav";
import { CurrentUserProvider, useCurrentUser } from "@/features/users/CurrentUserProvider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentUserProvider>
      <ShellContent>{children}</ShellContent>
    </CurrentUserProvider>
  );
}

function ShellContent({ children }: { children: ReactNode }) {
  const { status, user, error } = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <AppNav isAdmin={user?.role === "admin"} />
      {status === "error" ? <ErrorAlert>{error}</ErrorAlert> : null}
      {/* Page queries mount only once the session and profile are ready. */}
      {status === "ready" ? children : null}
      {status === "loading" ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
          <div className="h-7 w-48 animate-pulse rounded-md bg-line" />
          <div className="h-24 animate-pulse rounded-lg bg-line/60" />
          <div className="h-24 animate-pulse rounded-lg bg-line/60" />
        </div>
      ) : null}
    </div>
  );
}
