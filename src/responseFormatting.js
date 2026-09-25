export function formatResponseBody(body) {
  if (typeof body !== "string" || !body.trim()) return "";

  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
