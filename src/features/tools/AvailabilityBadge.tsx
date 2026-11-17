import { Badge } from "@/components/ui/Badge";
import { formatDate } from "./labels";

export function AvailabilityBadge({
  availability,
  availableFrom,
}: {
  availability: "available" | "on_loan";
  availableFrom?: string;
}) {
  if (availability === "available") return <Badge tone="green">Available</Badge>;
  return (
    <Badge tone="amber">On loan{availableFrom ? ` until ${formatDate(availableFrom)}` : ""}</Badge>
  );
}
