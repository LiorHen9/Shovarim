import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next embeds a handful of jsx-a11y rules, but not the full recommended
  // set. Enabling it explicitly is the cheap half of issue #41: docs/ACCESSIBILITY.md
  // lists eight WCAG items and states plainly that no automated check has ever run, and
  // Phase 6 is touching every page's boundaries plus adding a dark colour scheme that has
  // never been contrast-checked. See docs/DECISIONS.md ADR #55.
  //
  // Only the rules are spread, not the whole flat config: eslint-config-next already
  // registers the jsx-a11y plugin, and registering it twice is a hard ConfigError.
  {
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // functions/ is a separate TypeScript project (its own tsconfig/package.json,
    // see docs/DECISIONS.md #24) — only its compiled output needs excluding here.
    "functions/lib/**",
  ]),
]);

export default eslintConfig;
