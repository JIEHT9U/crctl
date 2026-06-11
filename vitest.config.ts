import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**"],
      exclude: ["src/index.ts"], // CLI wiring — covered by the smoke test
    },
  },
});
