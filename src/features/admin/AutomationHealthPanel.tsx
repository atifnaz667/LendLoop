"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ErrorAlert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAction } from "@/features/requests/RequestList";
import { relativeTime } from "@/lib/relativeTime";

/** Outbox health: failed deliveries are visible here and can be retried. */
export function AutomationHealthPanel() {
  const health = useQuery(api.webhookDeliveries.health);
  const retry = useMutation(api.webhookDeliveries.retry);
  const { error, busyId, run } = useAction();

  if (health === undefined)
    return <p className="text-sm text-muted">Loading automation status...</p>;

  const lastDelivered = health.recentDelivered[0];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Automation health</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Failed deliveries"
          value={health.failed.length}
          tone={health.failed.length ? "red" : "green"}
        />
        <Stat
          label="Waiting to send"
          value={health.pending.length}
          tone={health.pending.length ? "amber" : "green"}
        />
        <Card className="p-4">
          <p className="text-xs text-muted">Last delivered to n8n</p>
          <p className="mt-1 text-sm font-medium">
            {lastDelivered?.deliveredAt ? relativeTime(lastDelivered.deliveredAt) : "Nothing yet"}
          </p>
        </Card>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      {health.failed.length > 0 ? (
        <Card className="divide-y divide-line">
          {health.failed.map((d) => (
            <div
              key={d._id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.eventType}</span>
                  <Badge tone="red">Failed after {d.attempts} attempts</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {relativeTime(d.createdAt)} · {d.lastError ?? "Unknown error"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === d._id}
                onClick={() =>
                  run(d._id, () => retry({ deliveryId: d._id as Id<"webhookDeliveries"> }))
                }
              >
                Retry
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
      {health.pending.length > 0 ? (
        <Card className="divide-y divide-line">
          {health.pending.map((d) => (
            <div
              key={d._id}
              className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.eventType}</span>
                  <Badge tone="amber">
                    {d.attempts === 0 ? "Queued" : `Retrying after ${d.attempts} attempts`}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {relativeTime(d.createdAt)}
                  {d.nextAttemptAt ? ` · next try ${relativeTime(d.nextAttemptAt)}` : ""}
                  {d.lastError ? ` · ${d.lastError}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === d._id}
                onClick={() =>
                  run(d._id, () => retry({ deliveryId: d._id as Id<"webhookDeliveries"> }))
                }
              >
                Send now
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "green";
}) {
  const color = { red: "text-red-700", amber: "text-amber-700", green: "text-brand-700" }[tone];
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </Card>
  );
}
