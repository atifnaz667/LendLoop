import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { IncomingRequests } from "@/features/requests/IncomingRequests";

export const metadata: Metadata = { title: "Incoming requests" };

export default function IncomingPage() {
  return (
    <>
      <PageHeader
        title="Incoming requests"
        description="Approve or decline requests for your tools, and mark loans as returned."
      />
      <IncomingRequests />
    </>
  );
}
