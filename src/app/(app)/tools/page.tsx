import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrowseTools } from "@/features/tools/BrowseTools";

export const metadata: Metadata = { title: "Browse tools" };

export default function ToolsPage() {
  return (
    <>
      <PageHeader title="Browse tools" description="Find something to borrow from a neighbor." />
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={<p className="text-sm text-muted">Loading tools...</p>}>
        <BrowseTools />
      </Suspense>
    </>
  );
}
