"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestList, useAction } from "./RequestList";

export function MyRequests() {
  const rows = useQuery(api.borrowRequests.listMine);
  const cancel = useMutation(api.borrowRequests.cancel);
  const { error, busyId, run } = useAction();

  if (rows === undefined) return <p className="text-sm text-muted">Loading your requests...</p>;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No requests yet"
        description="Find something you need and ask to borrow it."
        action={
          <Link href="/tools" className="text-sm font-medium text-brand-700 hover:underline">
            Browse tools
          </Link>
        }
      />
    );
  }

  return (
    <RequestList
      rows={rows}
      error={error}
      counterpart={(row) => (
        <>
          from {row.lender.name}
          {row.lender.isTrustedLender ? " (Trusted Lender)" : ""}
        </>
      )}
      actions={(row) =>
        row.status === "pending" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busyId === row._id}
            onClick={() => run(row._id, () => cancel({ requestId: row._id }))}
          >
            Cancel request
          </Button>
        ) : null
      }
    />
  );
}
