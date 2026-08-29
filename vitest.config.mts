import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the `@/*` -> `src/*` path alias in tsconfig.json so unit tests can
  // import app modules the same way app code does.
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
