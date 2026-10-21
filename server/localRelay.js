import { randomBytes, timingSafeEqual } from "node:crypto";

export const RELAY_PATH = "/api/request";
export const HEALTH_PATH = "/api/health";
export const RELAY_TOKEN_HEADER = "x-api-workbench-token";
export const RELAY_TOKEN_META = "api-workbench-relay-token";
export const MAX_REQUEST_BYTES = 5_000_000;
export const MAX_RESPONSE_BYTES = 10_000_000;
export const RELAY_TIMEOUT_MS = 30_000;

export function createRelayToken() {
  return randomBytes(32).toString("base64url");
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function sameToken(provided, expected) {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rejects relay calls that did not come from the API Workbench page itself.
 * A cross-site page can send a "simple" POST without CORS preflight, so the relay
 * requires a JSON content type, a same-origin Origin header, and the per-server
 * token that is only embedded in the app's own HTML.
 */
export function checkRelayRequest(req, token) {
  if (req.method !== "POST") return { status: 405, message: "The relay only accepts POST requests." };

  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return { status: 415, message: "The relay requires a JSON request." };

  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin") return { status: 403, message: "Cross-site relay requests are not allowed." };

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host || origin !== `http://${host}`) return { status: 403, message: "Relay requests must come from the API Workbench page." };

  if (!sameToken(req.headers[RELAY_TOKEN_HEADER], token)) return { status: 403, message: "Missing or invalid relay token. Reload the API Workbench page." };

  return null;
}

export function readJsonBody(req, limit = MAX_REQUEST_BYTES) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > limit) {
      reject(Object.assign(new Error("Request configuration is too large."), { status: 413 }));
      req.resume();
      return;
    }

    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        chunks.length = 0;
        req.removeAllListeners("data");
        req.resume();
        reject(Object.assign(new Error("Request configuration is too large."), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(Object.assign(new Error("Invalid relay request JSON."), { status: 400 })); }
    });
    req.on("error", (error) => {
      if (done) return;
      done = true;
      reject(error);
    });
  });
}

/** Reads a fetch Response body as text, stopping once it exceeds the byte limit. */
export async function readLimitedText(response, limit = MAX_RESPONSE_BYTES) {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > limit) {
      chunks.push(value.subarray(0, limit - size));
      size = limit;
      await reader.cancel().catch(() => {});
      return { body: Buffer.concat(chunks).toString("utf8"), truncated: true };
    }
    chunks.push(value);
    size += value.byteLength;
  }
  return { body: Buffer.concat(chunks).toString("utf8"), truncated: false };
}

function relayHeaders(input) {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Relay headers must be an object."), { status: 400 });
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
}

export async function relay(input, origin, fetchImpl = fetch) {
  if (!input || typeof input.url !== "string" || !input.url) throw Object.assign(new Error("A target URL is required."), { status: 400 });
  const target = new URL(input.url, origin);
  if (!["http:", "https:"].includes(target.protocol)) throw Object.assign(new Error("Only HTTP and HTTPS targets are supported."), { status: 400 });

  const method = typeof input.method === "string" && input.method ? input.method.toUpperCase() : "GET";
  const result = await fetchImpl(target, {
    method,
    headers: relayHeaders(input.headers),
    body: ["GET", "HEAD"].includes(method) ? undefined : input.body,
    // Redirects are returned to the user instead of followed, so a public endpoint
    // cannot bounce the relay to an internal address the user never chose.
    redirect: "manual",
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  const { body, truncated } = await readLimitedText(result);
  return {
    status: result.status,
    statusText: result.statusText,
    headers: Object.fromEntries(result.headers.entries()),
    body,
    truncated,
    redirected: result.status >= 300 && result.status < 400 && result.headers.has("location"),
  };
}

export function localApi({ version, token = createRelayToken() } = {}) {
  return {
    name: "api-workbench-local-api",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: RELAY_TOKEN_META, content: token }, injectTo: "head" }];
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === HEALTH_PATH) {
          return json(res, 200, { ok: true, service: "API Workbench", version, timestamp: new Date().toISOString() });
        }
        if (path !== RELAY_PATH) return next();

        const rejected = checkRelayRequest(req, token);
        if (rejected) {
          req.resume();
          return json(res, rejected.status, { relayError: true, message: rejected.message, code: null });
        }

        try {
          const input = await readJsonBody(req);
          return json(res, 200, await relay(input, `http://${req.headers.host}`));
        } catch (error) {
          return json(res, error.status || 502, { relayError: true, message: error.message, code: error.cause?.code || error.code || null });
        }
      });
    },
  };
}
