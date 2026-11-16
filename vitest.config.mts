import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "convex",
          include: ["tests/convex/**/*.test.ts"],
          // convex-test runs functions in an edge-like runtime, matching Convex.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["convex/**/*.ts"],
      exclude: ["convex/_generated/**", "convex/**/*.config.ts"],
    },
  },
});
