# API Workbench v1.4.0

API Workbench is a local React/Vite application for testing local and online HTTP APIs.

## Windows startup

1. Extract the ZIP into a new folder.
2. Double-click `Start-API-Workbench.bat`.
3. The launcher verifies Node.js/npm, installs the exact dependency versions in `package-lock.json` (with `npm ci`, only when the lockfile has changed), and starts the app.
4. Your default browser opens after the server is ready.

The preferred URL is `http://localhost:5173`. If that port is already occupied, Vite automatically checks subsequent ports and opens the selected address (for example, `http://localhost:5174`). The terminal always displays the exact active URL.

## Features

- GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS requests
- Query parameters, headers, authentication, and request bodies
- Local relay mode for browser CORS restrictions
- Direct-browser mode for CORS testing
- Response status, timing, size, headers, and body
- Generated cURL commands
- JSON request-settings import and export
- Local request history with one-click restoration of parameters, headers, authentication type, body, transport, method, and URL (credentials are never saved in history; see Security)
- Per-entry trash controls for removing one saved request without clearing the rest of the history
- History filters for HTTP method and successful or error outcomes
- Clean history switching that removes body data from GET/HEAD requests and clears values from inactive authentication modes
- Automatic URL encoding for spaces, Unicode, unsafe path characters, and query values without double-encoding existing percent escapes
- Raw `#` characters are encoded as `%23` in paths and query values instead of being discarded as URL fragments
- Pretty-formatted JSON results with plain-text fallback
- Generated cURL displayed above response headers with one-click copy controls for cURL and result content
- Structured diagnostics for failed requests, with credentials redacted from URLs and no request bodies
- Built-in `/api/health` endpoint

## Security

- The local relay (`/api/request`) only accepts JSON requests from the API Workbench page itself. It checks the `Origin` header and a random per-launch token embedded in the page, so other websites open in your browser cannot use it to send requests from your machine.
- The relay does not follow redirects; a 3xx response is shown as-is so you can decide whether to request the `Location` target.
- Relayed responses are capped at 10 MB and relay request configurations at 5 MB.
- Request history in browser storage never contains bearer tokens, passwords, API key values, credential headers (such as `Authorization` and `Cookie`), credential query parameters, or `user:password@` in URLs. History saved by earlier versions is cleaned automatically on first load.
- Exported settings files contain credentials only after you confirm the warning.
- Generated cURL commands use single-quoted arguments, so pasted commands cannot run shell substitutions.
- Dependencies are pinned to exact versions.

## Manual commands

```text
npm ci
npm run dev
```

Use `Ctrl+C` in the terminal to stop the server.
