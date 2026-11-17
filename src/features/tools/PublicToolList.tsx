"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { categoryLabel } from "./labels";

/** Read-only list for visitors. The query returns name and category only. */
export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return <p className="text-center text-sm text-muted">Loading available tools...</p>;
  }
  if (tools.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        No tools are available right now. Sign in and be the first to lend one.
      </p>
    );
  }
  return (
    <Card className="divide-y divide-line">
      {tools.map((tool, index) => (
        // The public query intentionally returns no ids, so the position is the key.
        <div key={index} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="font-medium">{tool.name}</span>
          <span className="text-muted">{categoryLabel(tool.category)}</span>
        </div>
      ))}
    </Card>
  );
}
