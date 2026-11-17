import { convexTest } from "convex-test";
import schema from "@convex/schema";

/** All Convex modules, loaded the way convex-test expects. */
export const modules = import.meta.glob("../../convex/**/*.*s");

export function setup() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof setup>;

let counter = 0;

/** Signs a user in (mock Clerk identity) and provisions their profile. */
export async function signIn(
  t: TestConvex,
  opts: { name?: string; email?: string; role?: "admin" | "user" } = {},
) {
  counter += 1;
  const subject = `user_test_${counter}`;
  const identity = t.withIdentity({
    subject,
    issuer: "https://test.clerk.accounts.dev",
    name: opts.name ?? `Neighbor ${counter}`,
    email: opts.email ?? `neighbor${counter}@example.com`,
  });
  const { api } = await import("@convex/_generated/api");
  const userId = await identity.mutation(api.users.ensureCurrent, {});
  if (opts.role === "admin") {
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { role: "admin" });
    });
  }
  return { as: identity, userId, subject };
}

export const sampleTool = {
  name: "Cordless drill",
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V drill with two batteries and a bit set.",
};
