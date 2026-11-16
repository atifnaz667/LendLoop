import { HeroAuthAction } from "@/components/auth/HeroAuthAction";

/**
 * Public landing page. The read-only list of available tools is added in
 * Module 3 (tools), backed by a public Convex query that returns name and
 * category only.
 */
export default function HomePage() {
  return (
    <section className="py-12 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">LendLoop</h1>
      <p className="mt-3 text-lg text-muted">Borrow what you need. Lend what you don&apos;t.</p>
      <div className="mt-8">
        <HeroAuthAction />
      </div>
    </section>
  );
}
