import assert from "node:assert/strict";
import test from "node:test";
import { formatResponseBody } from "../src/responseFormatting.js";

test("pretty prints JSON response objects", () => {
  assert.equal(
    formatResponseBody('{"name":"Widget","details":{"active":true},"tags":["one","two"]}'),
    '{\n  "name": "Widget",\n  "details": {\n    "active": true\n  },\n  "tags": [\n    "one",\n    "two"\n  ]\n}',
  );
});

test("pretty prints JSON arrays", () => {
  assert.equal(formatResponseBody('[{"id":1},{"id":2}]'), '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]');
});

test("preserves plain text and empty responses", () => {
  assert.equal(formatResponseBody("plain text response"), "plain text response");
  assert.equal(formatResponseBody(""), "");
});
