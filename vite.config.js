import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) reject(new Error("Request configuration is too large."));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid relay request JSON.")); }
    });
    req.on("error", reject);
  });
}

function localApi() {
  return {
    name: "api-workbench-local-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] === "/api/health") {
          return json(res, 200, { ok: true, service: "API Workbench", version: "1.4.0", timestamp: new Date().toISOString() });
        }
        if (req.url?.split("?")[0] !== "/api/request" || req.method !== "POST") return next();
        try {
          const input = await readJson(req);
          if (!input.url || typeof input.url !== "string") return json(res, 400, { relayError: true, message: "A target URL is required." });
          const target = new URL(input.url, `http://${req.headers.host}`);
          if (!["http:", "https:"].includes(target.protocol)) return json(res, 400, { relayError: true, message: "Only HTTP and HTTPS targets are supported." });
          const result = await fetch(target, {
            method: input.method || "GET",
            headers: input.headers || {},
            body: ["GET", "HEAD"].includes(input.method) ? undefined : input.body,
            redirect: "follow",
            signal: AbortSignal.timeout(30_000),
          });
          const body = await result.text();
          return json(res, 200, { status: result.status, statusText: result.statusText, headers: Object.fromEntries(result.headers.entries()), body });
        } catch (error) {
          return json(res, 502, { relayError: true, message: error.message, code: error.cause?.code || error.code || null });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: false,
    open: true,
  },
});
