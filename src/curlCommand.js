/**
 * Quotes a value for POSIX shells. Single quotes disable every expansion
 * ($VAR, $(...), backticks, backslashes), so only the quote itself needs handling.
 */
export function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

export function buildCurlCommand({ method, url, headers = {}, body }) {
  const parts = ["curl", "-X", shellQuote(method), shellQuote(url)];
  for (const [key, value] of Object.entries(headers)) parts.push("-H", shellQuote(`${key}: ${value}`));
  if (typeof body === "string" && !["GET", "HEAD"].includes(method)) parts.push("--data-raw", shellQuote(body));
  return parts.join(" ");
}
