"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCurrentUser } from "@/features/users/CurrentUserProvider";

/** UI convenience only. Every admin query and mutation is enforced in Convex. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  if (user?.role !== "admin") {
    return <EmptyState title="Admins only" description="You don't have access to this page." />;
  }
  return <div className="flex flex-col gap-8">{children}</div>;
}
