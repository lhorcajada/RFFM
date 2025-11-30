import { defineConfig, loadEnv } from "vite";

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
    "https://rffmapi-hgfbczfxe5d6b7d2.westeurope-01.azurewebsites.net";

  const apiTargets: Record<string, string> = {
    development: apiTargetDev,
    local: apiTargetDev,
    production: apiTargetProd,
  };

  const apiTarget =
    env.VITE_API_PROXY_TARGET || apiTargets[appEnv] || apiTargetDev;

  return {
    plugins: [pluginReact()],
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
      // Expose a default API base URL to the client bundles (can be overridden by env)
      __VITE_API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL || ""),
      __VITE_APP_ENV__: JSON.stringify(appEnv),
    },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
      },
    },
    // Expose env to Vite via envPrefix or runtime replacement if needed
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom"))
                return "vendor-react";
              if (id.includes("@mui") || id.includes("@emotion"))
                return "vendor-mui";
              if (id.includes("lodash")) return "vendor-lodash";
              return "vendor";
            }
          },
        },
      },
    },
  };
});
