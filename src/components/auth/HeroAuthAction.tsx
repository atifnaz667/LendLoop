"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";

/** Landing page call to action. Only offers sign-in to signed-out visitors. */
export function HeroAuthAction() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <span aria-hidden className="inline-block h-10 w-52 animate-pulse rounded-md bg-line" />;
  }

  if (isSignedIn) {
    return <p className="text-sm text-muted">You&apos;re signed in.</p>;
  }

  return (
    <SignInButton mode="modal">
      <Button>Sign in to lend or borrow</Button>
    </SignInButton>
  );
}
