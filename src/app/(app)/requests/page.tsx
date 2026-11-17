import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "My requests" };

/** Placeholder until module 4 lands (see docs/roadmap.md). */
export default function Page() {
  return (
    <>
      <PageHeader title="My requests" description="Tools you asked to borrow." />
      <EmptyState title="No requests yet" description="This view arrives in the next update." />
    </>
  );
}
