import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Each test file gets a fresh VM context inside a reused worker, so the worker keeps
    // its compiled modules and jsdom setup instead of booting from scratch for every file.
    pool: "vmThreads",
    // VM contexts leak memory; recycle a worker once it grows past this to keep RAM bounded.
    vmMemoryLimit: "800MB",
    setupFiles: path.resolve(__dirname, "src/test/setupTests.ts"),
    exclude: ["node_modules", "dist", "playwright-*.js", "e2e/**"],
    testTimeout: 30000,
  },
});
