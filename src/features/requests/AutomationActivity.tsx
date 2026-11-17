import type { AutomationEventKind } from "@convex/shared/constants";
import { relativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/cn";

const LABELS: Record<AutomationEventKind, string> = {
  notification_sent: "Notification sent",
  notification_failed: "Notification failed",
  reminder_sent: "Reminder sent",
  reminder_failed: "Reminder failed",
};

/** Shows the latest automation steps n8n reported for a loan, newest first. */
export function AutomationActivity({
  activity,
}: {
  activity: { kind: AutomationEventKind; occurredAt: number }[];
}) {
  if (activity.length === 0) return null;
  return (
    <ul
      className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"
      aria-label="Automation activity"
    >
      {activity.map((event) => (
        <li
          key={`${event.kind}-${event.occurredAt}`}
          className={cn(event.kind.endsWith("_failed") && "text-red-700")}
        >
          {LABELS[event.kind]} {relativeTime(event.occurredAt)}
        </li>
      ))}
    </ul>
  );
}
