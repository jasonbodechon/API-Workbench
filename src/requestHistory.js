import { createRequestSnapshot, restoreRequestSnapshot } from "./requestSettings.js";
import { isSensitiveName, redactUrl, SENSITIVE_HEADER_NAMES, SENSITIVE_QUERY_NAMES } from "./secrets.js";

export const REQUEST_HISTORY_KEY = "api-workbench/request-history/v1";
export const REQUEST_HISTORY_LIMIT = 50;

const text = (value, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value) => Number.isFinite(value) ? value : null;

/**
 * History is kept in localStorage, so it never stores credentials: auth secrets,
 * credential-bearing header and query values, and user:password in the URL are
 * cleared. The auth type, username, and key name are kept so the user only has
 * to re-enter the secret after restoring an entry.
 */
export function stripCredentials(snapshot) {
  const apiKeyName = snapshot.auth.type === "api-key" ? [snapshot.auth.keyName] : [];
  const clearRows = (rows, list) => rows.map((row) => isSensitiveName(row.key, list, apiKeyName) ? { ...row, value: "" } : row);
  return {
    ...snapshot,
    url: redactUrl(snapshot.url, { extraQueryNames: apiKeyName, replacement: "" }),
    query: clearRows(snapshot.query, SENSITIVE_QUERY_NAMES),
    headers: clearRows(snapshot.headers, SENSITIVE_HEADER_NAMES),
    auth: { ...snapshot.auth, token: "", password: "", keyValue: "" },
  };
}

export function createHistoryEntry(request, outcome) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request: stripCredentials(createRequestSnapshot(request)),
    outcome: {
      ok: Boolean(outcome?.ok),
      status: number(outcome?.status),
      statusText: text(outcome?.statusText),
      elapsedMs: number(outcome?.elapsedMs),
      errorType: text(outcome?.errorType),
    },
  };
}

export function parseRequestHistory(source) {
  if (!source) return [];
  let parsed;
  try { parsed = JSON.parse(source); } catch { return []; }
  if (!Array.isArray(parsed)) return [];

  return parsed.slice(0, REQUEST_HISTORY_LIMIT).flatMap((entry) => {
    try {
      // Entries saved by earlier versions may still contain credentials.
      const request = stripCredentials(createRequestSnapshot(restoreRequestSnapshot(entry?.request)));
      return [{
        id: text(entry?.id) || crypto.randomUUID(),
        createdAt: text(entry?.createdAt) || new Date().toISOString(),
        request,
        outcome: {
          ok: Boolean(entry?.outcome?.ok),
          status: number(entry?.outcome?.status),
          statusText: text(entry?.outcome?.statusText),
          elapsedMs: number(entry?.outcome?.elapsedMs),
          errorType: text(entry?.outcome?.errorType),
        },
      }];
    } catch {
      return [];
    }
  });
}

export function restoreHistoryRequest(entry) {
  return restoreRequestSnapshot(entry.request);
}

export function filterRequestHistory(entries, method = "all", outcome = "all") {
  return entries.filter((entry) => {
    const matchesMethod = method === "all" || entry.request.method === method;
    const matchesOutcome = outcome === "all"
      || (outcome === "success" ? entry.outcome.ok : !entry.outcome.ok);
    return matchesMethod && matchesOutcome;
  });
}

export function removeRequestHistoryEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}
