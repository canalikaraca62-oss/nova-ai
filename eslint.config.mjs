import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,

  {
    files: ["**/*.{ts,tsx}"],

    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],

      "@typescript-eslint/no-floating-promises": "error",

      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],

      "prefer-const": "error",

      "eqeqeq": [
        "error",
        "always",
      ],

      "no-duplicate-imports": "error",

      "no-return-await": "error",

      "no-throw-literal": "error",

      "object-shorthand": [
        "error",
        "properties",
      ],

      "prefer-template": "error",

      "no-var": "error",
    },
  },

  {
    /*
     * Playwright E2E specs.
     *
     * Playwright's fixture API takes a callback named `use`, which the
     * React hooks rule misreads as a hook called outside a component:
     *
     *     problems: async ({ page }, use) => { await use(problems); }
     *
     * There is no React in tests/e2e — these run in Node and drive a
     * browser over the wire — so the rule cannot apply. It is disabled
     * for this directory only, rather than suppressed inline at the call
     * site or weakened project-wide.
     */
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "node_modules/**",
    "*.min.js",
    "next-env.d.ts",
    "package-lock.json",
    "public/**",
  ]),
]);