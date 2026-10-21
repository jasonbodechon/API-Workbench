// Header and query-parameter names whose values are treated as credentials.
export const SENSITIVE_HEADER_NAMES = [
  "authorization", "proxy-authorization", "cookie", "set-cookie",
  "x-api-key", "api-key", "apikey", "x-auth-token", "x-access-token", "x-csrf-token",
];

export const SENSITIVE_QUERY_NAMES = [
  "access_token", "id_token", "refresh_token", "token", "auth", "api_key", "apikey", "api-key",
  "key", "client_secret", "secret", "password", "pwd", "sig", "signature",
];

const normalize = (name) => String(name).trim().toLowerCase();

export function isSensitiveName(name, list, extraNames = []) {
  const value = normalize(name);
  return Boolean(value) && (list.includes(value) || extraNames.some((extra) => normalize(extra) === value));
}

const decode = (value) => {
  try { return decodeURIComponent(value.replaceAll("+", " ")); } catch { return value; }
};

/**
 * Removes credentials from a URL string without re-encoding the rest of it:
 * embedded user:password@ is dropped and sensitive query values are replaced.
 */
export function redactUrl(url, { extraQueryNames = [], replacement = "[REDACTED]" } = {}) {
  if (typeof url !== "string" || !url) return "";
  let result = url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/?#]*@/i, "$1");

  const queryStart = result.indexOf("?");
  if (queryStart === -1) return result;
  const hashStart = result.indexOf("#", queryStart);
  const queryEnd = hashStart === -1 ? result.length : hashStart;
  const query = result.slice(queryStart + 1, queryEnd)
    .split("&")
    .map((pair) => {
      const separator = pair.indexOf("=");
      if (separator === -1) return pair;
      const name = pair.slice(0, separator);
      return isSensitiveName(decode(name), SENSITIVE_QUERY_NAMES, extraQueryNames) ? `${name}=${replacement}` : pair;
    })
    .join("&");
  result = `${result.slice(0, queryStart + 1)}${query}${result.slice(queryEnd)}`;
  return result;
}
