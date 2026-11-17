import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "green" | "amber" | "red" | "blue";

const tones: Record<Tone, string> = {
  neutral: "bg-surface text-muted border-line",
  green: "bg-brand-50 text-brand-700 border-brand-100",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
