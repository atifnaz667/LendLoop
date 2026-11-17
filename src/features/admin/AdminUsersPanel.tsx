"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCurrentUser } from "@/features/users/useCurrentUser";
import { getErrorMessage } from "@/lib/errors";

/**
 * Members list with the Trusted Lender toggle. The UI hides this from
 * non-admins for convenience; the Convex functions enforce it regardless.
 */
export function AdminUsersPanel() {
  const { user, isLoading } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const members = useQuery(api.users.listForAdmin, isAdmin ? {} : "skip");
  const setTrusted = useMutation(api.users.setTrustedLender);
  const [pendingId, setPendingId] = useState<Id<"users"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted">Loading...</p>;
  if (!isAdmin) {
    return <EmptyState title="Admins only" description="You don't have access to this page." />;
  }
  if (members === undefined) return <p className="text-sm text-muted">Loading members...</p>;

  async function toggle(userId: Id<"users">, trusted: boolean) {
    setError(null);
    setPendingId(userId);
    try {
      await setTrusted({ userId, trusted });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Members</h2>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Card className="divide-y divide-line">
        {members.map((member) => (
          <div key={member._id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-medium">{member.name}</span>
              {member.role === "admin" ? <Badge tone="blue">Admin</Badge> : null}
              {member.isTrustedLender ? <Badge tone="green">Trusted Lender</Badge> : null}
            </div>
            <Button
              size="sm"
              variant={member.isTrustedLender ? "secondary" : "primary"}
              disabled={pendingId === member._id}
              onClick={() => toggle(member._id, !member.isTrustedLender)}
            >
              {member.isTrustedLender ? "Remove trusted" : "Mark trusted"}
            </Button>
          </div>
        ))}
      </Card>
    </section>
  );
}
