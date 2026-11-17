"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";

/** Landing page call to action. Only offers sign-in to signed-out visitors. */
export function HeroAuthAction() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <span aria-hidden className="inline-block h-10 w-52 animate-pulse rounded-md bg-line" />;
  }

  if (isSignedIn) {
    return (
      <Link
        href="/tools"
        className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Browse tools
      </Link>
    );
  }

  return (
    <SignInButton mode="modal" fallbackRedirectUrl="/tools">
      <Button>Sign in to lend or borrow</Button>
    </SignInButton>
  );
}
