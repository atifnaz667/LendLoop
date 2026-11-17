"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { addDays, todayIso } from "@convex/lib/dates";
import { LIMITS } from "@convex/shared/constants";
import { ErrorAlert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { getErrorMessage } from "@/lib/errors";

/** Inline "request to borrow" form. Dates use UTC calendar days, matching the server. */
export function RequestForm({
  toolId,
  onDone,
  onCancel,
}: {
  toolId: Id<"tools">;
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = todayIso();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const create = useMutation(api.borrowRequests.create);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await create({ toolId, startDate, endDate, message: message.trim() || undefined });
      onDone();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-line pt-3">
      <ErrorAlert>{error}</ErrorAlert>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor={`start-${toolId}`}>
          <Input
            id={`start-${toolId}`}
            type="date"
            required
            min={today}
            max={addDays(today, LIMITS.maxDaysAhead)}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate < e.target.value) setEndDate(e.target.value);
            }}
          />
        </Field>
        <Field label="Until" htmlFor={`end-${toolId}`}>
          <Input
            id={`end-${toolId}`}
            type="date"
            required
            min={startDate}
            max={addDays(startDate, LIMITS.maxLoanDays - 1)}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Message (optional)" htmlFor={`msg-${toolId}`}>
        <Textarea
          id={`msg-${toolId}`}
          className="min-h-16"
          maxLength={LIMITS.requestMessageMax}
          placeholder="What do you need it for? When can you pick it up?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={saving}>
          {saving ? "Sending..." : "Send request"}
        </Button>
      </div>
    </form>
  );
}
