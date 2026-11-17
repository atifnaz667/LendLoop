import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Browse tools" };

/** Placeholder until the tools module lands (see docs/roadmap.md, module 3). */
export default function ToolsPage() {
  return (
    <>
      <PageHeader title="Browse tools" description="Find something to borrow from a neighbor." />
      <EmptyState title="No tools listed yet" description="Listings arrive in the next update." />
    </>
  );
}
