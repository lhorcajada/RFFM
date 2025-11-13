import { defineConfig } from "vite";

export default defineConfig(async ({ command, mode }) => {
  const pluginReact = (await import("@vitejs/plugin-react")).default;
  return {
    plugins: [pluginReact()],
    server: {
      proxy: {
        "/api": {
          target: "https://localhost:7287",
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
