import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Incoming requests" };

/** Placeholder until module 4 lands (see docs/roadmap.md). */
export default function Page() {
  return (
    <>
      <PageHeader
        title="Incoming requests"
        description="Requests from neighbors to borrow your tools."
      />
      <EmptyState
        title="No incoming requests"
        description="This view arrives in the next update."
      />
    </>
  );
}
