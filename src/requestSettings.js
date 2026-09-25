const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const TRANSPORTS = ["relay", "direct"];
const AUTH_TYPES = ["none", "bearer", "basic", "api-key"];
const BODY_TYPES = ["none", "json", "text", "form"];

const text = (value, fallback = "") => typeof value === "string" ? value : fallback;
const bool = (value, fallback = true) => typeof value === "boolean" ? value : fallback;

const normalizeRows = (rows, includeIds) => {
  if (!Array.isArray(rows)) throw new Error("Parameters and headers must be arrays.");
  return rows.map((row) => ({
    ...(includeIds ? { id: crypto.randomUUID() } : {}),
    enabled: bool(row?.enabled),
    key: text(row?.key),
    value: text(row?.value),
  }));
};

const normalizeAuth = (auth) => {
  const type = AUTH_TYPES.includes(auth?.type) ? auth.type : "none";
  const normalized = {
    type,
    token: "",
    username: "",
    password: "",
    keyName: "X-API-Key",
    keyValue: "",
    keyLocation: "header",
  };

  if (type === "bearer") normalized.token = text(auth.token);
  if (type === "basic") {
    normalized.username = text(auth.username);
    normalized.password = text(auth.password);
  }
  if (type === "api-key") {
    normalized.keyName = text(auth.keyName, "X-API-Key");
    normalized.keyValue = text(auth.keyValue);
    normalized.keyLocation = auth.keyLocation === "query" ? "query" : "header";
  }

  return normalized;
};

const normalizeRequest = (request, includeIds) => {
  if (!request || typeof request !== "object") throw new Error("The request settings are missing.");

  const method = text(request.method).toUpperCase();
  if (!METHODS.includes(method)) throw new Error(`Unsupported HTTP method: ${method || "missing"}.`);
  if (!TRANSPORTS.includes(request.transport)) throw new Error("Unsupported request transport.");
  const requestedBodyType = BODY_TYPES.includes(request.bodyType) ? request.bodyType : "none";
  const allowsBody = !["GET", "HEAD"].includes(method);
  const bodyType = allowsBody ? requestedBodyType : "none";

  return {
    method,
    url: text(request.url),
    transport: request.transport,
    query: normalizeRows(request.query ?? [], includeIds),
    headers: normalizeRows(request.headers ?? [], includeIds),
    auth: normalizeAuth(request.auth),
    bodyType,
    body: bodyType === "none" ? "" : text(request.body),
  };
};

export function createRequestSnapshot(request) {
  return normalizeRequest(request, false);
}

export function restoreRequestSnapshot(snapshot) {
  return normalizeRequest(snapshot, true);
}

export function createRequestSettings(request) {
  return {
    schema: "api-workbench/request-settings",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    request: createRequestSnapshot(request),
  };
}

export function parseRequestSettings(source) {
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error("The selected file is not valid JSON."); }
  if (parsed?.schema !== "api-workbench/request-settings") throw new Error("This is not an API Workbench request settings file.");
  if (parsed?.schemaVersion !== 1) throw new Error(`Unsupported request settings version: ${parsed?.schemaVersion ?? "missing"}.`);
  return restoreRequestSnapshot(parsed.request);
}
