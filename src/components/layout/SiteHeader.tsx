import Link from "next/link";
import { AuthControls } from "@/components/auth/AuthControls";
import { BackendStatusBanner } from "@/components/auth/BackendStatusBanner";

export function SiteHeader() {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden
              className="inline-block size-6 rounded-full border-4 border-brand-500"
            />
            LendLoop
          </Link>
          <AuthControls />
        </div>
      </header>
      <BackendStatusBanner />
    </>
  );
}
