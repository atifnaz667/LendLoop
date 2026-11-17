"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TOOL_CATEGORIES, type ToolCategory } from "@convex/shared/constants";
import { ErrorAlert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestForm } from "@/features/requests/RequestForm";
import { getErrorMessage } from "@/lib/errors";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { CategoryFilter } from "./CategoryFilter";
import { categoryLabel, conditionLabel } from "./labels";

function parseCategory(value: string | null): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((c) => c === value);
}

export function BrowseTools() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The filter lives in the URL so it survives reloads and can be shared.
  const category = parseCategory(params.get("category"));
  const tools = useQuery(api.tools.browse, { category });
  const adminRemove = useMutation(api.tools.adminRemove);
  const [confirmId, setConfirmId] = useState<Id<"tools"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<Id<"tools"> | null>(null);
  const [sentId, setSentId] = useState<Id<"tools"> | null>(null);

  function setCategory(next: ToolCategory | undefined) {
    const query = next ? `?category=${next}` : "";
    router.replace(`${pathname}${query}`, { scroll: false });
  }

  async function remove(toolId: Id<"tools">) {
    setError(null);
    try {
      await adminRemove({ toolId });
      setConfirmId(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <CategoryFilter value={category} onChange={setCategory} />
      <ErrorAlert>{error}</ErrorAlert>
      {tools === undefined ? (
        <p className="text-sm text-muted">Loading tools...</p>
      ) : tools.length === 0 ? (
        <EmptyState
          title={
            category
              ? `No ${categoryLabel(category).toLowerCase()} listed yet`
              : "No tools listed yet"
          }
          description="Be the first to lend something from My listings."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool._id}>
              <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{tool.name}</h3>
                    <p className="text-xs text-muted">
                      {categoryLabel(tool.category)} · {conditionLabel(tool.condition)}
                    </p>
                  </div>
                  <AvailabilityBadge
                    availability={tool.availability}
                    availableFrom={tool.availableFrom}
                  />
                </div>
                <p className="line-clamp-3 text-sm text-muted">{tool.description}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted">
                      {tool.isMine ? "Your listing" : tool.lender.name}
                    </span>
                    {tool.lender.isTrustedLender ? (
                      <Badge tone="green">Trusted Lender</Badge>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {!tool.isMine && requestingId !== tool._id ? (
                      sentId === tool._id ? (
                        <span className="text-sm text-brand-700">Request sent</span>
                      ) : (
                        <Button size="sm" onClick={() => setRequestingId(tool._id)}>
                          Request to borrow
                        </Button>
                      )
                    ) : null}
                    {tool.canRemove ? (
                      confirmId === tool._id ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                            Keep
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => remove(tool._id)}>
                            Confirm remove
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(tool._id)}>
                          Remove
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
                {requestingId === tool._id ? (
                  <RequestForm
                    toolId={tool._id}
                    onCancel={() => setRequestingId(null)}
                    onDone={() => {
                      setRequestingId(null);
                      setSentId(tool._id);
                    }}
                  />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
