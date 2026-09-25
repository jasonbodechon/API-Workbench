import { useMemo, useRef, useState } from "react";
import { createRequestSettings, createRequestSnapshot, parseRequestSettings } from "./requestSettings.js";
import { createHistoryEntry, filterRequestHistory, parseRequestHistory, removeRequestHistoryEntry, REQUEST_HISTORY_KEY, REQUEST_HISTORY_LIMIT, restoreHistoryRequest } from "./requestHistory.js";
import { createRequestDiagnostics, diagnosticsAsText } from "./requestDiagnostics.js";
import { APP_VERSION_LABEL } from "./version.js";
import { encodeRequestUrl } from "./urlEncoding.js";
import { formatResponseBody } from "./responseFormatting.js";

const row = () => ({ id: crypto.randomUUID(), enabled: true, key: "", value: "" });
const initialRequest = {
  method: "GET", url: "/api/health", transport: "relay", query: [row()], headers: [row()],
  auth: { type: "none", token: "", username: "", password: "", keyName: "X-API-Key", keyValue: "", keyLocation: "header" },
  bodyType: "none", body: "",
};

const activePairs = (rows) => rows.filter((item) => item.enabled && item.key.trim()).map(({ key, value }) => [key.trim(), value]);

function buildTarget(request) {
  const encodedInput = encodeRequestUrl(request.url, window.location.origin);
  const isAbsolute = /^https?:\/\//i.test(encodedInput);
  const url = new URL(encodedInput, window.location.origin);
  activePairs(request.query).forEach(([key, value]) => url.searchParams.append(key, value));
  if (request.auth.type === "api-key" && request.auth.keyLocation === "query" && request.auth.keyName) url.searchParams.set(request.auth.keyName, request.auth.keyValue);
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}`;
}

function requestHeaders(request) {
  const headers = Object.fromEntries(activePairs(request.headers));
  if (request.auth.type === "bearer") headers.Authorization = `Bearer ${request.auth.token}`;
  if (request.auth.type === "basic") headers.Authorization = `Basic ${btoa(`${request.auth.username}:${request.auth.password}`)}`;
  if (request.auth.type === "api-key" && request.auth.keyLocation === "header" && request.auth.keyName) headers[request.auth.keyName] = request.auth.keyValue;
  if (request.bodyType === "json" && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
  if (request.bodyType === "form" && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) headers["Content-Type"] = "application/x-www-form-urlencoded";
  return headers;
}

function Rows({ rows, setRows, label }) {
  const update = (id, field, value) => setRows(rows.map((item) => item.id === id ? { ...item, [field]: value } : item));
  return <div className="rows">
    {rows.map((item) => <div className="row" key={item.id}>
      <input aria-label={`Enable ${label}`} type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, "enabled", event.target.checked)} />
      <input aria-label={`${label} name`} placeholder="Name" value={item.key} onChange={(event) => update(item.id, "key", event.target.value)} />
      <input aria-label={`${label} value`} placeholder="Value" value={item.value} onChange={(event) => update(item.id, "value", event.target.value)} />
      <button className="icon" type="button" onClick={() => setRows(rows.filter((rowItem) => rowItem.id !== item.id))} aria-label={`Remove ${label}`}>×</button>
    </div>)}
    <button className="subtle" type="button" onClick={() => setRows([...rows, row()])}>+ Add {label}</button>
  </div>;
}

function CopyButton({ copied, label, onClick }) {
  return <button className="copy-button" type="button" onClick={onClick} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
    <span className="copy-icon" aria-hidden="true">⧉</span>
    <span>{copied ? "Copied" : "Copy"}</span>
  </button>;
}

export default function App() {
  const [request, setRequest] = useState(initialRequest);
  const [history, setHistory] = useState(() => parseRequestHistory(localStorage.getItem(REQUEST_HISTORY_KEY)));
  const [historyMethodFilter, setHistoryMethodFilter] = useState("all");
  const [historyOutcomeFilter, setHistoryOutcomeFilter] = useState("all");
  const [tab, setTab] = useState("params");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [notice, setNotice] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const fileRef = useRef(null);
  const hasCredentials = useMemo(() => Boolean(request.auth.token || request.auth.password || request.auth.keyValue), [request.auth]);
  const patch = (partial) => setRequest((current) => ({ ...current, ...partial }));
  const patchAuth = (partial) => patch({ auth: { ...request.auth, ...partial } });
  const formattedResponseBody = useMemo(() => formatResponseBody(response?.body), [response?.body]);
  const filteredHistory = useMemo(
    () => filterRequestHistory(history, historyMethodFilter, historyOutcomeFilter),
    [history, historyMethodFilter, historyOutcomeFilter],
  );

  const copyText = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => current === field ? "" : current), 1600);
    } catch {
      setNotice("Copy failed. Your browser may not permit clipboard access.");
    }
  };

  const addHistoryEntry = (sentRequest, outcome) => {
    const entry = createHistoryEntry(sentRequest, outcome);
    setHistory((current) => {
      const next = [entry, ...current].slice(0, REQUEST_HISTORY_LIMIT);
      localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadHistoryEntry = (entry) => {
    setRequest(restoreHistoryRequest(entry));
    setResponse(null);
    setDiagnostics(null);
    setNotice("Complete request restored from history.");
  };

  const clearHistory = () => {
    if (!window.confirm("Clear all locally saved request history?")) return;
    localStorage.removeItem(REQUEST_HISTORY_KEY);
    setHistory([]);
    setNotice("Request history cleared.");
  };

  const deleteHistoryEntry = (id) => {
    setHistory((current) => {
      const next = removeRequestHistoryEntry(current, id);
      if (next.length) localStorage.setItem(REQUEST_HISTORY_KEY, JSON.stringify(next));
      else localStorage.removeItem(REQUEST_HISTORY_KEY);
      return next;
    });
    setNotice("History entry deleted.");
  };

  const send = async () => {
    setLoading(true); setResponse(null); setDiagnostics(null); setNotice("");
    const started = performance.now();
    const sentRequest = createRequestSnapshot(request);
    let target = "";
    try {
      target = buildTarget(request);
      const headers = requestHeaders(request);
      const canBody = !["GET", "HEAD"].includes(request.method) && request.bodyType !== "none";
      const options = { method: request.method, headers, body: canBody ? request.body : undefined };
      const result = request.transport === "relay"
        ? await fetch("/api/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: target, ...options }) })
        : await fetch(target, options);
      const relayPayload = request.transport === "relay" ? await result.json() : null;
      if (request.transport === "relay" && !result.ok && relayPayload?.relayError) throw Object.assign(new Error(relayPayload.message), { code: relayPayload.code, relayStatus: result.status });
      const status = relayPayload ? relayPayload.status : result.status;
      const statusText = relayPayload ? relayPayload.statusText : result.statusText;
      const responseHeaders = relayPayload ? relayPayload.headers : Object.fromEntries(result.headers.entries());
      const body = relayPayload ? relayPayload.body : await result.text();
      const elapsedMs = Math.round(performance.now() - started);
      setResponse({ status, statusText, headers: responseHeaders, body, elapsedMs, size: new Blob([body]).size, request: sentRequest });
      addHistoryEntry(sentRequest, { ok: status < 400, status, statusText, elapsedMs });
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - started);
      const requestDiagnostics = createRequestDiagnostics({ error, method: sentRequest.method, url: target || sentRequest.url, transport: sentRequest.transport, elapsedMs, relayStatus: error.relayStatus });
      setDiagnostics(requestDiagnostics);
      addHistoryEntry(sentRequest, { ok: false, elapsedMs, errorType: requestDiagnostics.type });
    } finally { setLoading(false); }
  };

  const exportSettings = () => {
    if (hasCredentials && !window.confirm("This file will contain authentication credentials in plain text. Export it anyway?")) return;
    const blob = new Blob([JSON.stringify(createRequestSettings(request), null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "api-workbench-request.json"; link.click(); URL.revokeObjectURL(link.href);
    setNotice("Request settings exported.");
  };

  const importSettings = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try { setRequest(parseRequestSettings(await file.text())); setNotice("Request settings imported."); }
    catch (error) { setNotice(`Import failed: ${error.message}`); }
  };

  const curl = (sourceRequest = request) => {
    const target = buildTarget(sourceRequest); const headers = requestHeaders(sourceRequest);
    const quote = (value) => `"${String(value).replaceAll('"', '\\"')}"`;
    const parts = ["curl", "-X", sourceRequest.method, quote(target), ...Object.entries(headers).flatMap(([key, value]) => ["-H", quote(`${key}: ${value}`)])];
    if (!["GET", "HEAD"].includes(sourceRequest.method) && sourceRequest.bodyType !== "none") parts.push("--data-raw", quote(sourceRequest.body));
    return parts.join(" ");
  };

  const generatedCurl = response ? curl(response.request) : "";

  return <div className="app">
    <header><div><span className="mark">AW</span><div><h1>API Workbench</h1><p>Local-first request testing</p></div></div><span className="version">{APP_VERSION_LABEL}</span></header>
    <main>
      <section className="request-card">
        <div className="request-line">
          <select aria-label="HTTP method" value={request.method} onChange={(event) => patch({ method: event.target.value })}>{["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => <option key={method}>{method}</option>)}</select>
          <input aria-label="Request URL" className="url" value={request.url} onChange={(event) => patch({ url: event.target.value })} placeholder="https://api.example.com/resource" />
          <button className="send" onClick={send} disabled={loading || !request.url.trim()}>{loading ? "Sending…" : "Send"}</button>
        </div>
        <div className="toolbar">
          <label>Transport <select value={request.transport} onChange={(event) => patch({ transport: event.target.value })}><option value="relay">Local relay</option><option value="direct">Direct browser</option></select></label>
          <span className="spacer" />
          <button className="subtle" onClick={exportSettings}>Export JSON</button>
          <button className="subtle" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input hidden ref={fileRef} type="file" accept="application/json,.json" onChange={importSettings} />
        </div>
        {notice && <p className="notice">{notice}</p>}
        <nav>{["params", "headers", "auth", "body"].map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>
        <div className="editor">
          {tab === "params" && <Rows label="parameter" rows={request.query} setRows={(query) => patch({ query })} />}
          {tab === "headers" && <Rows label="header" rows={request.headers} setRows={(headers) => patch({ headers })} />}
          {tab === "auth" && <div className="auth-grid">
            <label>Authentication<select value={request.auth.type} onChange={(event) => patchAuth({ type: event.target.value })}><option value="none">None</option><option value="bearer">Bearer token</option><option value="basic">Basic auth</option><option value="api-key">API key</option></select></label>
            {request.auth.type === "bearer" && <label>Token<input type="password" value={request.auth.token} onChange={(event) => patchAuth({ token: event.target.value })} /></label>}
            {request.auth.type === "basic" && <><label>Username<input value={request.auth.username} onChange={(event) => patchAuth({ username: event.target.value })} /></label><label>Password<input type="password" value={request.auth.password} onChange={(event) => patchAuth({ password: event.target.value })} /></label></>}
            {request.auth.type === "api-key" && <><label>Key name<input value={request.auth.keyName} onChange={(event) => patchAuth({ keyName: event.target.value })} /></label><label>Key value<input type="password" value={request.auth.keyValue} onChange={(event) => patchAuth({ keyValue: event.target.value })} /></label><label>Location<select value={request.auth.keyLocation} onChange={(event) => patchAuth({ keyLocation: event.target.value })}><option value="header">Header</option><option value="query">Query string</option></select></label></>}
          </div>}
          {tab === "body" && <><select value={request.bodyType} onChange={(event) => patch({ bodyType: event.target.value })}><option value="none">No body</option><option value="json">JSON</option><option value="text">Text</option><option value="form">URL encoded</option></select><textarea value={request.body} onChange={(event) => patch({ body: event.target.value })} disabled={request.bodyType === "none"} placeholder={'{\n  "key": "value"\n}'} /></>}
        </div>
      </section>
      <section className="response-card">
        <div className="response-title"><h2>Response</h2>{response && <span className={response.status < 400 ? "ok" : "bad"}>{response.status} {response.statusText}</span>}</div>
        {!response && !diagnostics && <div className="empty"><strong>Ready to test</strong><p>Send a request to inspect status, timing, headers, and response body.</p></div>}
        {diagnostics && <div className="failure"><h3>Request failed</h3><div className="debug"><h4>Debugging information</h4><dl><dt>Error type</dt><dd>{diagnostics.type}</dd><dt>Message</dt><dd>{diagnostics.message}</dd><dt>Request</dt><dd>{diagnostics.method} {diagnostics.url}</dd><dt>Transport</dt><dd>{diagnostics.transport}</dd><dt>Elapsed</dt><dd>{diagnostics.elapsedMs} ms</dd><dt>Likely fix</dt><dd>{diagnostics.suggestion}</dd></dl><button className="subtle" onClick={() => navigator.clipboard.writeText(diagnosticsAsText(diagnostics))}>Copy debug info</button></div></div>}
        {response && <>
          <div className="metrics"><span>{response.elapsedMs} ms</span><span>{response.size} bytes</span></div>
          <div className="response-section">
            <div className="response-section-title"><h3>Generated cURL</h3><CopyButton copied={copiedField === "curl"} label="generated cURL" onClick={() => copyText(generatedCurl, "curl")} /></div>
            <pre className="curl-output">{generatedCurl}</pre>
          </div>
          <details><summary>Response Headers</summary><pre>{JSON.stringify(response.headers, null, 2)}</pre></details>
          <div className="response-section">
            <div className="response-section-title"><h3>Result</h3><CopyButton copied={copiedField === "result"} label="result" onClick={() => copyText(formattedResponseBody, "result")} /></div>
            <pre className="body">{formattedResponseBody || "(empty response body)"}</pre>
          </div>
        </>}
      </section>
      <section className="history-card">
        <div className="history-title">
          <div><h2>Request history</h2><p>Select a call to restore every request setting.</p></div>
          <button className="subtle" type="button" onClick={clearHistory} disabled={!history.length}>Clear history</button>
        </div>
        <p className="history-warning">History is stored only in this browser. Parameters, headers, authentication values, and bodies are included so calls can be reproduced exactly.</p>
        <div className="history-filters" aria-label="History filters">
          <label>Method
            <select value={historyMethodFilter} onChange={(event) => setHistoryMethodFilter(event.target.value)}>
              <option value="all">All methods</option>
              {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label>Result
            <select value={historyOutcomeFilter} onChange={(event) => setHistoryOutcomeFilter(event.target.value)}>
              <option value="all">All results</option>
              <option value="success">Successful</option>
              <option value="error">Errors</option>
            </select>
          </label>
          <span className="history-count">Showing {filteredHistory.length} of {history.length}</span>
        </div>
        {!history.length && <div className="history-empty">No requests have been sent yet.</div>}
        {history.length > 0 && !filteredHistory.length && <div className="history-empty">No history entries match these filters.</div>}
        <div className="history-list">
          {filteredHistory.map((entry) => {
            const parameterCount = entry.request.query.filter((item) => item.enabled && item.key).length;
            const headerCount = entry.request.headers.filter((item) => item.enabled && item.key).length;
            const resultLabel = entry.outcome.status ? `${entry.outcome.status} ${entry.outcome.statusText}`.trim() : entry.outcome.errorType || "Failed";
            return <div className="history-entry" key={entry.id}>
              <button className="history-load" type="button" onClick={() => loadHistoryEntry(entry)}>
                <span className={`history-method method-${entry.request.method.toLowerCase()}`}>{entry.request.method}</span>
                <span className="history-request"><strong>{entry.request.url}</strong><small>{parameterCount} params · {headerCount} headers · {entry.request.auth.type} auth · {entry.request.bodyType} body · {entry.request.transport}</small></span>
                <span className="history-result"><strong className={entry.outcome.ok ? "history-success" : "history-failed"}>{resultLabel}</strong><small>{new Date(entry.createdAt).toLocaleString()} · {entry.outcome.elapsedMs ?? "—"} ms</small></span>
              </button>
              <button className="history-delete" type="button" onClick={() => deleteHistoryEntry(entry.id)} aria-label={`Delete ${entry.request.method} request to ${entry.request.url}`} title="Delete history entry">
                <span aria-hidden="true">🗑</span>
              </button>
            </div>;
          })}
        </div>
      </section>
    </main>
    <footer><span>API Workbench {APP_VERSION_LABEL}</span><span>Runs locally · Credentials are never included in diagnostics</span></footer>
  </div>;
}
