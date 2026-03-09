import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target:
          process.env.VITE_API_TARGET ??
          ((process.env.DOCKER || fs.existsSync("/.dockerenv"))
            ? "http://host.docker.internal:8000"
            : "http://localhost:8000"),
        changeOrigin: true,
      },
    },
  },
});
