import { defineConfig, loadEnv } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "VITE_");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8080";

  return {
    plugins: [react()],
    server: {
      host: true,
      strictPort: true,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/auth": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});