import { defineConfig, loadEnv } from "vite";

// Avoid requiring @types/node in the frontend tooling config: declare minimal `process`
declare const process: any;

export default defineConfig(async ({ command, mode }) => {
  const pluginReact = (await import("@vitejs/plugin-react")).default;

  const env = loadEnv(mode, (process as any).cwd(), "");
  const appEnv = env.VITE_APP_ENV || mode || "development";

  // Default API base urls for environments — override with env vars when needed
  const apiTargets: Record<string, string> = {
    development: "https://localhost:7287",
    local: "https://localhost:7287",
    production:
      "https://rffmapi-hgfbczfxe5d6b7d2.westeurope-01.azurewebsites.net",
  };

  const apiTarget =
    env.VITE_API_PROXY_TARGET || apiTargets[appEnv] || apiTargets.development;

  return {
    plugins: [pluginReact()],
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
  };
});
