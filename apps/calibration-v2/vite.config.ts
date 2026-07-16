import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  css: { postcss: {} },
  optimizeDeps: {
    exclude: ["sql.js"],
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    fs: { allow: [".."] },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
});
