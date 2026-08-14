# ortho32-mcp

MCP Server for ORTHO32 — the nervous system that turns libraries into an OS.

> **CLIENT of ORTHO services via `ORTHOServiceClient` → `ortho32-api` HTTP. NOT a backend.**

## Routing Planes

Four routing planes per `ORTHO32RoutingV6`:

1. **UI ROUTING** — what application/window should appear? (`ortho://app/*`, `ortho://workspace/*`)
2. **INTENT ROUTING** — what operation does the human/agent want? (`ortho.agent_dispatch` via `IntentRouter`)
3. **SERVICE ROUTING** — what backend performs it? (`build`, `test`, `verify`, `tensor`, `marketplace`)
4. **FABRIC ROUTING** — what hardware block executes it? (`trace`, `device`, `fabric`)

Results travel back upward: `Hardware -> Completion -> Service Event -> App Model -> Window -> Human`.

## Invariants

- `cycles` / `cycleNumber` are always `number` (integer) — **NEVER wall-clock ms**
- `ortho_verify_theorem` status comes **only** from actual checker output (`CheckerOutput.status`), never string inference
- `hardware.reset` requires elevated scope `hardware.reset` — default scope cannot self-escalate
- All tool outputs are typed from `src/types.ts`, no raw string responses
- `ortho_agent_dispatch` uses `IntentRouter` path, never mutates UI state

## URL Scheme

```
ortho://app/terminal
ortho://app/ide
ortho://ide/file/rtl/fabric/arbiter.sv?line=184
ortho://settings/security
ortho://hardware/device/ortho0
ortho://proof/rtl_deterministic
ortho://trace/cycle/420
ortho://workspace/fabric
https://... -> Browser
```

Workspace stores **routes not UI objects** — replay on login reconstructs desktop.

## Tools

| Tool | Plane | Scopes |
|------|-------|--------|
| `ortho_build` | Service | `build.execute` |
| `ortho_test` | Service | `test.execute` |
| `ortho_verify_theorem` | Service | `verify.execute` |
| `ortho_trace` | Fabric | `trace.read` |
| `ortho_device` | Fabric | `device.read` / `hardware.reset` (elevated) |
| `ortho_tensor` | Service | `tensor.execute` |
| `ortho_fabric` | Fabric | `fabric.execute` |
| `ortho_marketplace` | Service | `marketplace.read` / `write` |
| `ortho_agent_dispatch` | Intent | `agent.dispatch` |
| `ortho_workspace` | UI | `workspace.read` / `write` |

## Setup

```bash
npm install
npm run build
ORTHO32_TOKEN=<token> ORTHO32_API_URL=https://api.ortho32.local/v1 npm start
```

Env:

- `ORTHO32_TOKEN` (or `ORTHO_TOKEN`) — JWT with scopes. Must include `hardware.reset` to reset hardware; default scopes cannot self-escalate.
- `ORTHO32_API_URL` — base for `ORTHOServiceClient` (default `https://api.ortho32.local/v1`)

### MCP Client Config

```json
{
  "mcpServers": {
    "ortho32": {
      "command": "node",
      "args": ["/path/to/ortho32-mcp/dist/index.js"],
      "env": {
        "ORTHO32_TOKEN": "...",
        "ORTHO32_API_URL": "https://api.ortho32.local/v1"
      }
    }
  }
}
```

## Resources

- `ortho://proof/rtl_deterministic`
- `ortho://trace/cycle/420`
- `ortho://hardware/device/ortho0`
- `ortho://workspace/fabric`

## Prompts

- `verify_rtl` — verify theorem via checker
- `trace_waveform` — trace at cycleNumber
- `fabric_debug` — four-plane debug

## Test

```bash
npm test
```

Tests enforce: integer cycles, checker-only status, elevated `hardware.reset`, typed outputs, IntentRouter.
