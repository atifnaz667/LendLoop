"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ErrorAlert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getErrorMessage } from "@/lib/errors";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { categoryLabel, conditionLabel } from "./labels";
import { ToolForm, type ToolFormValues } from "./ToolForm";

type Mode = { kind: "idle" } | { kind: "create" } | { kind: "edit"; toolId: Id<"tools"> };

export function MyListings() {
  const tools = useQuery(api.tools.listMine);
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [confirmId, setConfirmId] = useState<Id<"tools"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(values: ToolFormValues) {
    await create(values);
    setMode({ kind: "idle" });
  }

  async function handleDelete(toolId: Id<"tools">) {
    setError(null);
    try {
      await remove({ toolId });
      setConfirmId(null);
    } catch (e) {
      setError(getErrorMessage(e));
      setConfirmId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My listings"
        description="Tools you are lending to neighbors."
        actions={
          mode.kind === "idle" ? (
            <Button onClick={() => setMode({ kind: "create" })}>List a tool</Button>
          ) : null
        }
      />
      {mode.kind === "create" ? (
        <Card className="p-4">
          <h2 className="mb-3 font-medium">List a tool</h2>
          <ToolForm
            submitLabel="List tool"
            onSubmit={handleCreate}
            onCancel={() => setMode({ kind: "idle" })}
          />
        </Card>
      ) : null}
      <ErrorAlert>{error}</ErrorAlert>
      {tools === undefined ? (
        <p className="text-sm text-muted">Loading your listings...</p>
      ) : tools.length === 0 && mode.kind !== "create" ? (
        <EmptyState
          title="You haven't listed anything yet"
          description="Got a ladder, a drill or a tent you rarely use? Lend it to a neighbor."
          action={<Button onClick={() => setMode({ kind: "create" })}>List a tool</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {tools.map((tool) => (
            <li key={tool._id}>
              <Card className="p-4">
                {mode.kind === "edit" && mode.toolId === tool._id ? (
                  <ToolForm
                    initial={{
                      name: tool.name,
                      category: tool.category,
                      condition: tool.condition,
                      description: tool.description,
                    }}
                    submitLabel="Save changes"
                    onSubmit={async (values) => {
                      await update({ toolId: tool._id, ...values });
                      setMode({ kind: "idle" });
                    }}
                    onCancel={() => setMode({ kind: "idle" })}
                  />
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{tool.name}</h3>
                        <AvailabilityBadge
                          availability={tool.availability}
                          availableFrom={tool.availableFrom}
                        />
                      </div>
                      <p className="text-xs text-muted">
                        {categoryLabel(tool.category)} · {conditionLabel(tool.condition)}
                      </p>
                      <p className="mt-2 text-sm text-muted">{tool.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {confirmId === tool._id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                            Keep
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(tool._id)}>
                            Confirm delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setMode({ kind: "edit", toolId: tool._id })}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(tool._id)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
