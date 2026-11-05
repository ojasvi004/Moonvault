import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
  },
});
