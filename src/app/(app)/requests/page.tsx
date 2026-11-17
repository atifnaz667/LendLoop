import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { MyRequests } from "@/features/requests/MyRequests";

export const metadata: Metadata = { title: "My requests" };

export default function RequestsPage() {
  return (
    <>
      <PageHeader title="My requests" description="Tools you asked to borrow." />
      <MyRequests />
    </>
  );
}
