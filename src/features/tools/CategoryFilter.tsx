"use client";

import { CATEGORY_LABELS, TOOL_CATEGORIES, type ToolCategory } from "@convex/shared/constants";
import { cn } from "@/lib/cn";

export function CategoryFilter({
  value,
  onChange,
}: {
  value: ToolCategory | undefined;
  onChange: (category: ToolCategory | undefined) => void;
}) {
  const options: { key: ToolCategory | undefined; label: string }[] = [
    { key: undefined, label: "All" },
    ...TOOL_CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABELS[c] })),
  ];
  return (
    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-white text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
