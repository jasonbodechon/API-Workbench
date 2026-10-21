import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import test from "node:test";
import { buildCurlCommand, shellQuote } from "../src/curlCommand.js";
import { createRequestDiagnostics, diagnosticsAsText } from "../src/requestDiagnostics.js";
import { redactUrl } from "../src/secrets.js";
import { checkRelayRequest, MAX_RESPONSE_BYTES, readJsonBody, readLimitedText, relay, RELAY_TOKEN_HEADER } from "../server/localRelay.js";

const TOKEN = "test-token-value";
const validHeaders = {
  host: "localhost:5173",
  origin: "http://localhost:5173",
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  [RELAY_TOKEN_HEADER]: TOKEN,
};

test("relay accepts same-origin JSON requests that carry the page token", () => {
  assert.equal(checkRelayRequest({ method: "POST", headers: validHeaders }, TOKEN), null);
});

test("relay rejects cross-site and forged requests", () => {
  const cases = {
    "simple text/plain POST": { ...validHeaders, "content-type": "text/plain" },
    "form POST": { ...validHeaders, "content-type": "application/x-www-form-urlencoded" },
    "foreign origin": { ...validHeaders, origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    "other localhost app": { ...validHeaders, origin: "http://localhost:3000", "sec-fetch-site": "same-site" },
    "missing origin": { ...validHeaders, origin: undefined },
    "missing token": { ...validHeaders, [RELAY_TOKEN_HEADER]: undefined },
    "wrong token": { ...validHeaders, [RELAY_TOKEN_HEADER]: "guess" },
  };
  for (const [name, headers] of Object.entries(cases)) {
    const rejected = checkRelayRequest({ method: "POST", headers }, TOKEN);
    assert.ok(rejected && rejected.status >= 400, `${name} should be rejected`);
  }
  assert.equal(checkRelayRequest({ method: "GET", headers: validHeaders }, TOKEN).status, 405);
});

test("relay does not follow redirects and only allows HTTP(S)", async () => {
  let options;
  const fakeFetch = async (_url, init) => {
    options = init;
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
  };
  const result = await relay({ url: "https://example.test/", method: "get" }, "http://localhost:5173", fakeFetch);
  assert.equal(options.redirect, "manual");
  assert.equal(options.method, "GET");
  assert.equal(result.status, 302);
  assert.equal(result.redirected, true);
  await assert.rejects(relay({ url: "file:///etc/passwd" }, "http://localhost:5173", fakeFetch), /Only HTTP and HTTPS/);
});

test("relay caps response size", async () => {
  const big = new Response(new Uint8Array(MAX_RESPONSE_BYTES + 1024).fill(97));
  const { body, truncated } = await readLimitedText(big);
  assert.equal(truncated, true);
  assert.equal(body.length, MAX_RESPONSE_BYTES);
  assert.deepEqual(await readLimitedText(new Response("ok")), { body: "ok", truncated: false });
});

test("relay rejects oversized request bodies without buffering them", async () => {
  const req = Object.assign(new EventEmitter(), { headers: {}, resume() {} });
  const pending = readJsonBody(req, 10);
  req.emit("data", Buffer.from("01234567890123"));
  await assert.rejects(pending, (error) => error.status === 413);

  const declared = Object.assign(new EventEmitter(), { headers: { "content-length": "999" }, resume() {} });
  await assert.rejects(readJsonBody(declared, 10), (error) => error.status === 413);
});

test("shell quoting prevents command substitution in generated cURL", () => {
  assert.equal(shellQuote("it's"), `'it'\\''s'`);
  const command = buildCurlCommand({
    method: "POST",
    url: "https://example.test/$(touch /tmp/pwned)",
    headers: { "X-Test": "`id` $HOME \\ \"q\" 'single'" },
    body: '{"a":"$(whoami)"}',
  });
  const echoed = execFileSync("sh", ["-c", command.replace(/^curl/, "printf '%s\\n'")], { encoding: "utf8" });
  assert.deepEqual(echoed.trim().split("\n"), [
    "-X", "POST", "https://example.test/$(touch /tmp/pwned)",
    "-H", "X-Test: `id` $HOME \\ \"q\" 'single'",
    "--data-raw", '{"a":"$(whoami)"}',
  ]);
  assert.ok(!buildCurlCommand({ method: "GET", url: "https://x.test", body: "ignored" }).includes("--data-raw"));
});

test("diagnostics redact credentials in URLs", () => {
  const url = "https://user:pa55@example.test/v1?page=2&custom_key=SECRET1&access_token=SECRET2";
  const diagnostics = createRequestDiagnostics({
    error: new Error(`request to ${url} failed, reason: getaddrinfo ENOTFOUND example.test`),
    method: "GET", url, transport: "relay", elapsedMs: 5, secretQueryNames: ["custom_key"],
  });
  const text = diagnosticsAsText(diagnostics);
  for (const secret of ["pa55", "SECRET1", "SECRET2", "user:"]) assert.ok(!text.includes(secret), `diagnostics leaked ${secret}`);
  assert.equal(diagnostics.url, "https://example.test/v1?page=2&custom_key=[REDACTED]&access_token=[REDACTED]");
  assert.equal(diagnostics.type, "DNS lookup failed");
});

test("URL redaction leaves non-secret URLs untouched", () => {
  for (const url of ["/api/health", "https://example.test/a%20b?x=1&y#frag", "https://example.test/?q=caf%C3%A9"]) {
    assert.equal(redactUrl(url), url);
  }
});
