import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LendLoop", template: "%s | LendLoop" },
  description: "Borrow what you need. Lend what you don't.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* ClerkProvider must wrap ConvexClientProvider (official integration order). */}
        <ClerkProvider>
          <ConvexClientProvider>
            <SiteHeader />
            <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
