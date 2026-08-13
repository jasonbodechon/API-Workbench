const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const TRANSPORTS = ["relay", "direct"];
const AUTH_TYPES = ["none", "bearer", "basic", "api-key"];

const text = (value, fallback = "") => typeof value === "string" ? value : fallback;
const bool = (value, fallback = true) => typeof value === "boolean" ? value : fallback;

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) throw new Error("Parameters and headers must be arrays.");
  return rows.map((row) => ({
    id: crypto.randomUUID(),
    enabled: bool(row?.enabled),
    key: text(row?.key),
    value: text(row?.value),
  }));
};

export function createRequestSettings(request) {
  return {
    schema: "api-workbench/request-settings",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    request,
  };
}

export function parseRequestSettings(source) {
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error("The selected file is not valid JSON."); }
  if (parsed?.schema !== "api-workbench/request-settings") throw new Error("This is not an API Workbench request settings file.");
  if (parsed?.schemaVersion !== 1) throw new Error(`Unsupported request settings version: ${parsed?.schemaVersion ?? "missing"}.`);
  const request = parsed.request;
  if (!request || typeof request !== "object") throw new Error("The request settings are missing.");
  const method = text(request.method).toUpperCase();
  if (!METHODS.includes(method)) throw new Error(`Unsupported HTTP method: ${method || "missing"}.`);
  if (!TRANSPORTS.includes(request.transport)) throw new Error("Unsupported request transport.");
  if (!AUTH_TYPES.includes(request.auth?.type)) throw new Error("Unsupported authentication type.");
  return {
    method,
    url: text(request.url),
    transport: request.transport,
    query: normalizeRows(request.query ?? []),
    headers: normalizeRows(request.headers ?? []),
    auth: {
      type: request.auth.type,
      token: text(request.auth.token),
      username: text(request.auth.username),
      password: text(request.auth.password),
      keyName: text(request.auth.keyName, "X-API-Key"),
      keyValue: text(request.auth.keyValue),
      keyLocation: request.auth.keyLocation === "query" ? "query" : "header",
    },
    bodyType: ["none", "json", "text", "form"].includes(request.bodyType) ? request.bodyType : "none",
    body: text(request.body),
  };
}
