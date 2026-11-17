import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "convex/_generated/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    // Data access is only allowed inside convex/models. Handlers and services go through a model.
    files: ["convex/**/*.ts"],
    ignores: ["convex/models/**", "convex/_generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='ctx'][property.name='db']",
          message: "Use a model in convex/models for database access.",
        },
      ],
    },
  },
  {
    // n8n Code node bodies: run inside n8n with require(), $env, $input and console logging.
    files: ["n8n/code/**/*.js"],
    languageOptions: {
      sourceType: "script",
      parserOptions: { ecmaFeatures: { globalReturn: true } },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
];

export default config;
