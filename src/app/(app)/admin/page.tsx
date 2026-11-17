import type { Metadata } from "next";
import { AdminUsersPanel } from "@/features/admin/AdminUsersPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" description="Moderate the board and recognize reliable lenders." />
      <AdminUsersPanel />
    </>
  );
}
