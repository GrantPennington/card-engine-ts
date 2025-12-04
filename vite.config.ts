// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".", // use project root
  build: {
    outDir: "dist-web" // keep separate from TS build output
  },
  resolve: {
    alias: {
      // optional: so you can do import from "@/core/blackjack"
      "@": "/src"
    }
  }
});
