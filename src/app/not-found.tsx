import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="That page doesn't exist or was moved."
      action={
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to LendLoop
        </Link>
      }
    />
  );
}
