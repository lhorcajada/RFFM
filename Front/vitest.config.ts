import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: path.resolve(__dirname, "src/test/setupTests.ts"),
    exclude: ["node_modules", "dist", "playwright-*.js"],
  },
});
