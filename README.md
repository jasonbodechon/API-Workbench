# API Workbench v1.4.0

API Workbench is a local React/Vite application for testing local and online HTTP APIs.

## Windows startup

1. Extract the ZIP into a new folder.
2. Double-click `Start-API-Workbench.bat`.
3. The launcher verifies Node.js/npm, installs or updates dependencies, and starts the app.
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
- Complete local request history with one-click restoration of parameters, headers, authentication, body, transport, method, and URL
- Per-entry trash controls for removing one saved request without clearing the rest of the history
- History filters for HTTP method and successful or error outcomes
- Clean history switching that removes body data from GET/HEAD requests and clears values from inactive authentication modes
- Automatic URL encoding for spaces, Unicode, unsafe path characters, and query values without double-encoding existing percent escapes
- Raw `#` characters are encoded as `%23` in paths and query values instead of being discarded as URL fragments
- Pretty-formatted JSON results with plain-text fallback
- Generated cURL displayed above response headers with one-click copy controls for cURL and result content
- Structured diagnostics for failed requests without credentials or request bodies
- Built-in `/api/health` endpoint

## Manual commands

```text
npm install
npm run dev
```

Use `Ctrl+C` in the terminal to stop the server.
