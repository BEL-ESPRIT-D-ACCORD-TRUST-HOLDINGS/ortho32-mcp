# ortho32-mcp

Deterministic stdio MCP server implemented in AWK.

This repository is intentionally small. The MCP server reads one JSON-RPC message per line from `stdin`, dispatches methods in AWK, and writes one JSON-RPC response per line to `stdout`.

Diagnostics go to `stderr`. `stdout` is protocol only.

## Architecture

```text
MCP client
  -> JSON-RPC over stdio
  -> bin/ortho32-mcp.awk
  -> explicit method dispatch
  -> deterministic AWK tools
  -> JSON-RPC response on stdout
```

AWK is used as the primary runtime:

```text
record -> pattern/action -> deterministic transformation -> JSON result
```

The implementation demonstrates that AWK's record-oriented stream model is structurally compatible with MCP stdio message processing. It does not claim AWK is inherently an MCP language, and it does not execute arbitrary AWK supplied by a client.

## Supported MCP Methods

- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call`

The server distinguishes requests, notifications, responses, and protocol errors. JSON-RPC responses sent to the server are ignored, as required for a server-side stdio runtime.

## Tools

| Tool | Purpose |
| --- | --- |
| `awk_count` | Count lines, non-empty lines, and characters |
| `awk_fields` | Split records into fields using an explicit separator |
| `awk_filter` | Return lines matching an AWK regular expression |
| `awk_regex` | Count lines matching an AWK regular expression |
| `awk_transform` | Apply `upper`, `lower`, or `trim` |

Each tool has an explicit JSON schema in the `tools/list` response.

## Determinism

For the same server state and same request input, tool output is identical.

The core avoids:

- random numbers
- timestamps in protocol output
- shell execution from client-controlled input
- LLM/model inference
- hidden external service calls

## Running

On Unix-like systems:

```bash
awk -f bin/ortho32-mcp.awk
```

On this Windows checkout, Git for Windows AWK works:

```powershell
& "C:\Program Files\Git\usr\bin\awk.exe" -f .\bin\ortho32-mcp.awk
```

Example request:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
```

## AWK-Only and AWK + jq Modes

Current implementation: AWK-only.

The server includes a small deterministic JSON boundary parser tailored to the supported MCP request shapes. `jq` is not required.

Future `jq` integration can be added as a boundary utility for broader JSON parsing, but dispatch and tool execution should remain in AWK.

## Tests

```bash
npm test
```

The test harness drives the AWK server over stdin/stdout and covers:

- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call`
- unknown method
- unknown tool
- invalid arguments
- multiple sequential requests
- malformed JSON
- deterministic replay
- protocol-only stdout

Set a specific AWK executable if needed:

```bash
AWK=/path/to/awk npm test
```

## Security Boundary

Client input is treated as untrusted data.

Tool names resolve through explicit dispatch only. The server does not evaluate client-supplied AWK programs and does not interpolate client strings into shell commands.


---

## Sovereign Boundary

This repository operates under the **SnapKitty Method**: public by default, sovereign by construction.

```
CODE        → PUBLIC      (this repository)
PROOF       → PUBLIC      (Lean 4 / formal verification artifacts)
SPEC        → PUBLIC      (interfaces, schemas, invariants)
HISTORY     → PUBLIC      (cryptographic provenance, WORM-sealed)

AUTHORITY   → SOVEREIGN   (Bel Esprit D'Accord Irrevocable Trust)
STATE       → SOVEREIGN   (credentials, private data, operational secrets)
EXECUTION   → AUTHORIZED  (requires sovereign state — not in this repo)
```

> **"Here is the machine. You do not own the state it operates on."**

Reading the source does not grant execution authority. Forking the repo does not grant deployment rights. The code is verifiable. The authority is not transferable.

**[→ Full architecture: SOVEREIGN_METHOD.md](./SOVEREIGN_METHOD.md)**

**[→ License terms: LICENSE](./LICENSE)** · **[→ IP estate: NOTICE](./NOTICE)**

---

*Copyright (C) 2026 Bel Esprit D'Accord Irrevocable Trust (EIN 42-697643) · `Ω = TRUST ∧ CODE`*
