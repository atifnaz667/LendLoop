"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";

/**
 * Header auth controls. Driven by Clerk's session state (not Convex's), so the
 * Sign in button never shows to someone Clerk already signed in, even while the
 * Convex connection is still being established or has failed.
 */
export function AuthControls() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <span aria-hidden className="h-8 w-20 animate-pulse rounded-md bg-line" />;
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <Button size="sm">Sign in</Button>
      </SignInButton>
    );
  }

  return <UserButton />;
}
