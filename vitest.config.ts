import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Only the pure domain layer is unit-tested. It holds the logic that
    // actually broke in production (review scheduling, IST maths, timer
    // accumulation) and needs no DOM to exercise.
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/features/**/lib/**"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
