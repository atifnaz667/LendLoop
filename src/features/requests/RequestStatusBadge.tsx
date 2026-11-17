import type { RequestStatus } from "@convex/shared/constants";
import { Badge } from "@/components/ui/Badge";

const LABELS: Record<
  RequestStatus,
  { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" }
> = {
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "On loan", tone: "blue" },
  declined: { label: "Declined", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  returned: { label: "Returned", tone: "green" },
};

export function RequestStatusBadge({
  status,
  isOverdue,
}: {
  status: RequestStatus;
  isOverdue: boolean;
}) {
  if (isOverdue) return <Badge tone="red">Overdue</Badge>;
  const { label, tone } = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
