"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestList, useAction } from "./RequestList";

export function IncomingRequests() {
  const rows = useQuery(api.borrowRequests.listIncoming);
  const approve = useMutation(api.borrowRequests.approve);
  const decline = useMutation(api.borrowRequests.decline);
  const markReturned = useMutation(api.borrowRequests.markReturned);
  const { error, busyId, run } = useAction();

  if (rows === undefined) return <p className="text-sm text-muted">Loading requests...</p>;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No incoming requests"
        description="When a neighbor asks to borrow one of your tools, it shows up here."
      />
    );
  }

  return (
    <RequestList
      rows={rows}
      error={error}
      counterpart={(row) => <>requested by {row.borrower.name}</>}
      actions={(row) => {
        const busy = busyId === row._id;
        if (row.status === "pending") {
          return (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => run(row._id, () => decline({ requestId: row._id }))}
              >
                Decline
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(row._id, () => approve({ requestId: row._id }))}
              >
                Approve
              </Button>
            </>
          );
        }
        if (row.status === "approved") {
          return (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(row._id, () => markReturned({ requestId: row._id }))}
            >
              Mark as returned
            </Button>
          );
        }
        return null;
      }}
    />
  );
}
