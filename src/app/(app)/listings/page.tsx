import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "My listings" };

/** Placeholder until module 3 lands (see docs/roadmap.md). */
export default function Page() {
  return (
    <>
      <PageHeader title="My listings" description="Tools you are lending to neighbors." />
      <EmptyState title="No listings yet" description="This view arrives in the next update." />
    </>
  );
}
