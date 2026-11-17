"use client";

import { useState, type FormEvent } from "react";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  LIMITS,
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type ToolCategory,
  type ToolCondition,
} from "@convex/shared/constants";
import { ErrorAlert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { getErrorMessage } from "@/lib/errors";

export interface ToolFormValues {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
}

const EMPTY: ToolFormValues = {
  name: "",
  category: "power_tools",
  condition: "good",
  description: "",
};

/**
 * Create and edit form. Mirrors the server limits for fast feedback; the
 * server validates again and is the source of truth.
 */
export function ToolForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ToolFormValues;
  submitLabel: string;
  onSubmit: (values: ToolFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ToolFormValues>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ToolFormValues>(key: K, value: ToolFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ErrorAlert>{error}</ErrorAlert>
      <Field label="Name" htmlFor="tool-name">
        <Input
          id="tool-name"
          required
          minLength={2}
          maxLength={LIMITS.toolNameMax}
          placeholder="Cordless drill"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="tool-category">
          <Select
            id="tool-category"
            value={values.category}
            onChange={(e) => set("category", e.target.value as ToolCategory)}
          >
            {TOOL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Condition" htmlFor="tool-condition">
          <Select
            id="tool-condition"
            value={values.condition}
            onChange={(e) => set("condition", e.target.value as ToolCondition)}
          >
            {TOOL_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="Short description"
        htmlFor="tool-description"
        hint={`${values.description.length}/${LIMITS.toolDescriptionMax}. Mention anything a borrower should know (batteries, attachments, care).`}
      >
        <Textarea
          id="tool-description"
          required
          minLength={5}
          maxLength={LIMITS.toolDescriptionMax}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
