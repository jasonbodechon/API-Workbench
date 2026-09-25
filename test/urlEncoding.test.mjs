import assert from "node:assert/strict";
import test from "node:test";
import { encodeRequestUrl } from "../src/urlEncoding.js";

const baseUrl = "http://localhost:5173";

test("encodes special characters in an absolute URL", () => {
  const encoded = encodeRequestUrl(
    "https://example.test/a folder/café/[draft]|item?q=hello world&symbols={value}|^`",
    baseUrl,
  );

  assert.equal(
    encoded,
    "https://example.test/a%20folder/caf%C3%A9/%5Bdraft%5D%7Citem?q=hello+world&symbols=%7Bvalue%7D%7C%5E%60",
  );
});

test("encodes special characters in a relative local URL", () => {
  assert.equal(
    encodeRequestUrl("/api/widget names/[current]?label=café | blue", baseUrl),
    "/api/widget%20names/%5Bcurrent%5D?label=caf%C3%A9+%7C+blue",
  );
});

test("does not double encode existing percent escapes", () => {
  assert.equal(
    encodeRequestUrl("https://example.test/already%20encoded?q=already%2Fencoded", baseUrl),
    "https://example.test/already%20encoded?q=already%2Fencoded",
  );
});

test("encodes raw hash characters instead of treating them as fragments", () => {
  assert.equal(
    encodeRequestUrl("https://example.test/items/name#1?tag=issue#42", baseUrl),
    "https://example.test/items/name%231?tag=issue%2342",
  );
  assert.equal(
    encodeRequestUrl("/api/items/#featured", baseUrl),
    "/api/items/%23featured",
  );
});

test("does not double encode an existing percent-encoded hash", () => {
  assert.equal(
    encodeRequestUrl("https://example.test/items/name%231?tag=issue%2342", baseUrl),
    "https://example.test/items/name%231?tag=issue%2342",
  );
});
