"use client";

import { useState, type ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { ErrorAlert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/features/tools/labels";
import { getErrorMessage } from "@/lib/errors";
import { RequestStatusBadge } from "./RequestStatusBadge";

export type RequestRow = FunctionReturnType<typeof api.borrowRequests.listMine>[number];

/** Runs an action and surfaces its error, shared by the request screens. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function run(id: string, action: () => Promise<unknown>) {
    setError(null);
    setBusyId(id);
    try {
      await action();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }
  return { error, busyId, run };
}

export function RequestList({
  rows,
  counterpart,
  actions,
  error,
}: {
  rows: RequestRow[];
  counterpart: (row: RequestRow) => ReactNode;
  actions: (row: RequestRow) => ReactNode;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert>{error}</ErrorAlert>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row._id}>
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{row.toolName}</h3>
                  <RequestStatusBadge status={row.status} isOverdue={row.isOverdue} />
                  {row.toolRemoved ? <Badge>Listing removed</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(row.startDate)} to {formatDate(row.endDate)} · {counterpart(row)}
                </p>
                {row.message ? (
                  <p className="mt-2 rounded-md bg-surface px-3 py-2 text-sm">
                    &ldquo;{row.message}&rdquo;
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">{actions(row)}</div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
