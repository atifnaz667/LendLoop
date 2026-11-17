import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/AdminGate";
import { AdminUsersPanel } from "@/features/admin/AdminUsersPanel";
import { AllLoansPanel } from "@/features/admin/AllLoansPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" description="Moderate the board and recognize reliable lenders." />
      <AdminGate>
        <AllLoansPanel />
        <AdminUsersPanel />
      </AdminGate>
    </>
  );
}
