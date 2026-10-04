import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The domain layer is pure — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
