import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localApi } from "./server/localRelay.js";
import { APP_VERSION } from "./src/version.js";

export default defineConfig({
  plugins: [react(), localApi({ version: APP_VERSION })],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: false,
    open: true,
  },
});
