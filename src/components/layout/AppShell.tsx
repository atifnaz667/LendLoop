"use client";

import type { ReactNode } from "react";
import { AppNav } from "@/components/layout/AppNav";
import { useCurrentUser } from "@/features/users/useCurrentUser";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, error } = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <AppNav isAdmin={user?.role === "admin"} />
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}
