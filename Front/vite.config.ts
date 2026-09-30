import { defineConfig, loadEnv } from "vite";
import { loadOrderPlugin } from "./vite-plugin-load-order";

// Avoid requiring @types/node in the frontend tooling config: declare minimal `process`
declare const process: any;

export default defineConfig(async ({ command, mode }) => {
  const pluginReact = (await import("@vitejs/plugin-react")).default;

  const env = loadEnv(mode, (process as any).cwd(), "");
  const appEnv = env.VITE_APP_ENV || mode || "development";

  // Read proxy target URLs from env vars with fallback defaults
  const apiTargetDev =
    env.VITE_API_PROXY_TARGET_DEV || "https://localhost:7287";
  const apiTargetProd =
    env.VITE_API_PROXY_TARGET_PROD ||
    "https://rffm-api.calmground-92cb0105.westeurope.azurecontainerapps.io";

  const apiTargets: Record<string, string> = {
    development: apiTargetDev,
    local: apiTargetDev,
    production: apiTargetProd,
  };

  const apiTarget =
    env.VITE_API_PROXY_TARGET || apiTargets[appEnv] || apiTargetDev;

  const { readFileSync } = await import("node:fs");
  const { execSync } = await import("node:child_process");
  const appVersion: string = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf-8")
  ).version;
  // Netlify exposes COMMIT_REF; locally fall back to git.
  const resolveCommit = (): string => {
    const netlifyCommit = (process as any).env.COMMIT_REF as string | undefined;
    if (netlifyCommit) return netlifyCommit.slice(0, 7);
    try {
      return execSync("git rev-parse --short=7 HEAD").toString().trim();
    } catch {
      return "";
    }
  };
  const appCommit = resolveCommit();

  return {
    plugins: [
      pluginReact({
        jsxRuntime: "automatic",
      }),
      loadOrderPlugin(),
    ],
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "@mui/material",
        "@mui/icons-material",
        "@emotion/react",
        "@emotion/styled",
      ],
    },
    define: {
      global: "globalThis",
      // Expose a default API base URL to the client bundles (can be overridden by env)
      __VITE_API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL || ""),
      __VITE_APP_ENV__: JSON.stringify(appEnv),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
      "import.meta.env.VITE_APP_COMMIT": JSON.stringify(appCommit),
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Keep /api prefix so backend routes like /api/catalog/... resolve correctly.
          rewrite: (path: string) => path,
        },
      },
    },
    // Expose env to Vite via envPrefix or runtime replacement if needed
    build: {
      chunkSizeWarningLimit: 1000,
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            // Bundle all React/MUI/Emotion together to avoid initialization order issues
            vendor: [
              "react",
              "react-dom",
              "react/jsx-runtime",
              "react-router-dom",
              "@emotion/react",
              "@emotion/styled",
              "@mui/material",
              "@mui/icons-material",
            ],
          },
        },
      },
    },
  };
});
