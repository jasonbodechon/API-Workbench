import assert from "node:assert/strict";
import test from "node:test";
import { createRequestSettings, createRequestSnapshot, parseRequestSettings } from "../src/requestSettings.js";
import { createHistoryEntry, filterRequestHistory, parseRequestHistory, removeRequestHistoryEntry, restoreHistoryRequest } from "../src/requestHistory.js";

const completeRequest = {
  method: "POST",
  url: "https://example.test/widgets",
  transport: "relay",
  query: [
    { id: "query-1", enabled: true, key: "page", value: "2" },
    { id: "query-2", enabled: false, key: "debug", value: "true" },
  ],
  headers: [
    { id: "header-1", enabled: true, key: "Accept", value: "application/json" },
    { id: "header-2", enabled: false, key: "X-Disabled", value: "saved-too" },
  ],
  auth: {
    type: "api-key",
    token: "bearer-value",
    username: "test-user",
    password: "test-password",
    keyName: "X-API-Key",
    keyValue: "secret-key",
    keyLocation: "header",
  },
  bodyType: "json",
  body: '{"name":"Widget"}',
};

test("JSON export and import preserve every request field", () => {
  const exported = JSON.stringify(createRequestSettings(completeRequest));
  const imported = parseRequestSettings(exported);
  assert.deepEqual(createRequestSnapshot(imported), createRequestSnapshot(completeRequest));
});

test("history persistence and restoration preserve every request field", () => {
  const entry = createHistoryEntry(completeRequest, { ok: true, status: 201, statusText: "Created", elapsedMs: 42 });
  const [persisted] = parseRequestHistory(JSON.stringify([entry]));
  assert.deepEqual(createRequestSnapshot(restoreHistoryRequest(persisted)), createRequestSnapshot(completeRequest));
  assert.deepEqual(persisted.outcome, { ok: true, status: 201, statusText: "Created", elapsedMs: 42, errorType: "" });
});

test("switching from POST history to GET history clears incompatible request data", () => {
  const staleGetRequest = {
    ...completeRequest,
    method: "GET",
    url: "https://example.test/widgets/42",
    query: [{ enabled: true, key: "view", value: "summary" }],
    headers: [],
    auth: {
      type: "none",
      token: "stale-bearer-token",
      username: "stale-user",
      password: "stale-password",
      keyName: "X-Old-Key",
      keyValue: "stale-api-key",
      keyLocation: "query",
    },
    bodyType: "json",
    body: '{"stale":true}',
  };

  const entry = createHistoryEntry(staleGetRequest, { ok: true, status: 200, statusText: "OK", elapsedMs: 8 });
  const restored = restoreHistoryRequest(entry);

  assert.equal(restored.method, "GET");
  assert.equal(restored.bodyType, "none");
  assert.equal(restored.body, "");
  assert.deepEqual(restored.headers, []);
  assert.deepEqual(restored.query.map(({ enabled, key, value }) => ({ enabled, key, value })), [{ enabled: true, key: "view", value: "summary" }]);
  assert.deepEqual(restored.auth, {
    type: "none",
    token: "",
    username: "",
    password: "",
    keyName: "X-API-Key",
    keyValue: "",
    keyLocation: "header",
  });
});

test("history can be filtered by method and success or error outcome", () => {
  const getSuccess = createHistoryEntry({ ...completeRequest, method: "GET", bodyType: "none", body: "" }, { ok: true, status: 200 });
  const postError = createHistoryEntry(completeRequest, { ok: false, status: 500 });
  const postSuccess = createHistoryEntry(completeRequest, { ok: true, status: 201 });
  const entries = [getSuccess, postError, postSuccess];

  assert.deepEqual(filterRequestHistory(entries, "POST", "all"), [postError, postSuccess]);
  assert.deepEqual(filterRequestHistory(entries, "all", "error"), [postError]);
  assert.deepEqual(filterRequestHistory(entries, "POST", "success"), [postSuccess]);
});

test("deleting one history entry preserves every other entry", () => {
  const first = createHistoryEntry(completeRequest, { ok: true, status: 201 });
  const second = createHistoryEntry({ ...completeRequest, url: "https://example.test/other" }, { ok: false, status: 404 });

  assert.deepEqual(removeRequestHistoryEntry([first, second], first.id), [second]);
});
