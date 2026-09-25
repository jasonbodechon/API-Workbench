const classify = (message, transport) => {
  const lower = message.toLowerCase();
  if (/refused|econnrefused/.test(lower)) return ["Connection refused", "Confirm the target API is running and its host and port are correct."];
  if (/enotfound|dns|getaddrinfo/.test(lower)) return ["DNS lookup failed", "Check the hostname and your network or DNS connection."];
  if (/timeout|timed out|abort/.test(lower)) return ["Request timed out", "The server may be unavailable or responding too slowly."];
  if (/certificate|tls|ssl/.test(lower)) return ["TLS or certificate error", "Check the certificate and use a trusted HTTPS endpoint."];
  if (transport === "direct" && /failed to fetch|networkerror/.test(lower)) return ["Browser network or CORS failure", "Try Local relay mode. If direct mode is required, verify the API permits this browser origin."];
  return ["Network request failed", "Check the URL, target service, network connection, and request transport."];
};

export function createRequestDiagnostics({ error, method, url, transport, elapsedMs, relayStatus }) {
  const message = error instanceof Error ? error.message : String(error);
  const [type, suggestion] = classify(message, transport);
  return {
    type,
    code: error?.code || null,
    message,
    method,
    url,
    transport,
    elapsedMs,
    relayStatus: relayStatus || null,
    online: typeof navigator === "undefined" ? null : navigator.onLine,
    suggestion,
    timestamp: new Date().toISOString(),
  };
}

export function diagnosticsAsText(item) {
  return [
    "API Workbench request diagnostics",
    `Time: ${item.timestamp}`,
    `Error type: ${item.type}`,
    item.code ? `Error code: ${item.code}` : null,
    `Message: ${item.message}`,
    `Request: ${item.method} ${item.url}`,
    `Transport: ${item.transport}`,
    `Elapsed: ${item.elapsedMs} ms`,
    item.relayStatus ? `Relay status: ${item.relayStatus}` : null,
    `Browser online: ${item.online}`,
    `Suggestion: ${item.suggestion}`,
  ].filter(Boolean).join("\n");
}
