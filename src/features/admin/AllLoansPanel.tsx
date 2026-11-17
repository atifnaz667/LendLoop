"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestStatusBadge } from "@/features/requests/RequestStatusBadge";
import { formatDate } from "@/features/tools/labels";
import { cn } from "@/lib/cn";

type Filter = "all" | "active" | "overdue" | "returned";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
];

/** Admin: every loan on the board. Rendered only for admins; the query enforces it too. */
export function AllLoansPanel() {
  const loans = useQuery(api.borrowRequests.listAllLoans);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = (loans ?? []).filter((loan) => {
    if (filter === "active") return loan.status === "approved" && !loan.isOverdue;
    if (filter === "overdue") return loan.isOverdue;
    if (filter === "returned") return loan.status === "returned";
    return true;
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">All loans</h2>
        <div role="group" aria-label="Filter loans" className="flex gap-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm",
                filter === key ? "bg-ink text-white" : "text-muted hover:bg-surface",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {loans === undefined ? (
        <p className="text-sm text-muted">Loading loans...</p>
      ) : visible.length === 0 ? (
        <EmptyState title="No loans to show" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Tool</th>
                <th className="px-4 py-2 font-medium">Lender</th>
                <th className="px-4 py-2 font-medium">Borrower</th>
                <th className="px-4 py-2 font-medium">Dates</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((loan) => (
                <tr key={loan._id}>
                  <td className="px-4 py-2 font-medium">{loan.toolName}</td>
                  <td className="px-4 py-2">{loan.lender.name}</td>
                  <td className="px-4 py-2">{loan.borrower.name}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">
                    {formatDate(loan.startDate)} to {formatDate(loan.endDate)}
                  </td>
                  <td className="px-4 py-2">
                    <RequestStatusBadge status={loan.status} isOverdue={loan.isOverdue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
