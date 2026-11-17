"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Route-level error boundary. Shows a friendly message and a retry, never the
 * raw error (which could include internal details). The digest helps match
 * the server log.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title="Something went wrong"
      description={
        error.digest ? `Please try again. Reference: ${error.digest}` : "Please try again."
      }
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
