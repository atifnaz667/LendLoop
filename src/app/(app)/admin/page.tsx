import type { Metadata } from "next";
import { AdminGate } from "@/features/admin/AdminGate";
import { AdminUsersPanel } from "@/features/admin/AdminUsersPanel";
import { AllLoansPanel } from "@/features/admin/AllLoansPanel";
import { AutomationHealthPanel } from "@/features/admin/AutomationHealthPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" description="Moderate the board and recognize reliable lenders." />
      <AdminGate>
        <AutomationHealthPanel />
        <AllLoansPanel />
        <AdminUsersPanel />
      </AdminGate>
    </>
  );
}
