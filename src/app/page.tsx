import { HeroAuthAction } from "@/components/auth/HeroAuthAction";
import { PublicToolList } from "@/features/tools/PublicToolList";

/** Public landing page: tagline, read-only list of available tools, sign-in. */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="pt-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">LendLoop</h1>
        <p className="mt-3 text-lg text-muted">Borrow what you need. Lend what you don&apos;t.</p>
        <div className="mt-8">
          <HeroAuthAction />
        </div>
      </section>
      <section aria-labelledby="available-heading" className="mx-auto w-full max-w-2xl">
        <h2 id="available-heading" className="mb-3 text-sm font-medium text-muted">
          Available in the neighborhood
        </h2>
        <PublicToolList />
      </section>
    </div>
  );
}
