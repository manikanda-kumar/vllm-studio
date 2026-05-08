# Continuity Ledger

## Goal

Cross-platform mobile device integration for vLLM Studio using mobile-mcp (MCP SSE transport). Must work on Mac and Windows without PATH dependency issues.

**Success criteria**: Mobile panel lists devices and captures screenshots via mobile-mcp on both platforms.

## Constraints/Assumptions

- mobile-mcp uses **stdio** MCP transport (simpler than SSE, works cross-platform)
- Requires @modelcontextprotocol/sdk for proper client implementation
- Current mobilecli approach has PATH issues in Electron (fixed temporarily)
- mobile-mcp package: `@mobilenext/mobile-mcp@0.0.54` (pinned)

## Key Decisions

- Pursue MCP SSE integration despite complexity (cross-platform benefit)
- Phased approach: temporary mobilecli fix → full MCP SSE client
- Keep pi-runtime extension architecture, change backend from HTTP routes to MCP

## State

### Done

- Fixed Electron PATH issue in app-server.ts (uses `enhancedPath()` helper)
- Fixed hook jq "Argument list too long" error (use stdin instead of --argjson)
- Installed `@modelcontextprotocol/sdk` and `@mobilenext/mobile-mcp@0.0.54`
- Probed mobile-mcp capabilities over stdio (see Capability Matrix below)
- Rewrote `mobile-mcp.ts` with `Client` + `StdioClientTransport`, singleton, start-lock, reconnect
- Created cross-platform spawn helper `frontend/src/lib/system/spawn.ts`
- Migrated API routes (devices, screenshot, tap, button) to new client with structured 503 errors
- Packaged pi-extensions as compiled JS for Electron
- Added health/diagnostics endpoint and UI banners
- Implemented graceful shutdown for mobile-mcp child process
- Pinned `@mobilenext/mobile-mcp@0.0.54` in `optionalDependencies`; local copy preferred over `npx`

### Now

- Final acceptance gate verification
- Remaining: boot/logs/stream path cleanup (no hardcoded paths)

### Next

1. Apply cross-platform spawn helper to boot/logs/stream routes
2. Update CONTINUITY.md with final out-of-scope list
3. Run full test matrix

## Working Set

- `/Users/manik/Github/vllm-studio/frontend/src/lib/mobile-mcp.ts` - MCP client (complete)
- `/Users/manik/Github/vllm-studio/frontend/src/lib/system/spawn.ts` - cross-platform spawn helper
- `/Users/manik/Github/vllm-studio/frontend/src/app/api/agent/mobile/*/route.ts` - API routes
- `/Users/manik/Github/vllm-studio/frontend/desktop/logic/app-server.ts` - graceful shutdown
- `/Users/manik/.claude/hooks/stop_hook.sh` - jq fix applied

## Project Learnings

- Electron on macOS doesn't inherit shell PATH - must add well-known dirs explicitly
- jq --argjson fails with large args - use `jq -s` with process substitution instead
- mobile-mcp supports **stdio** transport natively; no need for SSE/HTTP on port 3456
- MCP SDK `Client` + `StdioClientTransport` is the correct integration pattern
- Node >= 22 required (verified with v25.9.0)

---

## Capability Matrix

**Source**: `@mobilenext/mobile-mcp@0.0.54` probed over stdio on 2026-05-08.
**Node version**: v25.9.0 (requirement: >= 22).

### Tools Available

| MCP Tool Name                                | Maps to Route                  | Status    |
| -------------------------------------------- | ------------------------------ | --------- |
| `mobile_list_available_devices`              | `/api/agent/mobile/devices`    | Migrate   |
| `mobile_take_screenshot`                     | `/api/agent/mobile/screenshot` | Migrate   |
| `mobile_click_on_screen_at_coordinates`      | `/api/agent/mobile/tap`        | Migrate   |
| `mobile_press_button`                        | `/api/agent/mobile/button`     | Migrate   |
| `mobile_type_keys`                           | Future (typeText)              | Available |
| `mobile_get_screen_size`                     | Future (getScreenSize)         | Available |
| `mobile_list_elements_on_screen`             | Future (listElements)          | Available |
| `mobile_list_apps`                           | —                              | Available |
| `mobile_launch_app`                          | —                              | Available |
| `mobile_terminate_app`                       | —                              | Available |
| `mobile_install_app`                         | —                              | Available |
| `mobile_uninstall_app`                       | —                              | Available |
| `mobile_double_tap_on_screen`                | —                              | Available |
| `mobile_long_press_on_screen_at_coordinates` | —                              | Available |
| `mobile_open_url`                            | —                              | Available |
| `mobile_swipe_on_screen`                     | —                              | Available |
| `mobile_save_screenshot`                     | —                              | Available |
| `mobile_set_orientation`                     | —                              | Available |
| `mobile_get_orientation`                     | —                              | Available |
| `mobile_start_screen_recording`              | —                              | Available |
| `mobile_stop_screen_recording`               | —                              | Available |
| `mobile_list_crashes`                        | —                              | Available |
| `mobile_get_crash`                           | —                              | Available |

### Tools NOT Available

| Desired Capability | Reason                         | Current Workaround                                               |
| ------------------ | ------------------------------ | ---------------------------------------------------------------- |
| Boot device        | No `mobile_boot_device` tool   | `mobilecli` via `/api/agent/mobile/boot`                         |
| Stream logs        | No `mobile_stream_logs` tool   | `adb logcat` / `xcrun simctl spawn` via `/api/agent/mobile/logs` |
| Screen stream      | No `mobile_stream_screen` tool | `serve-sim` via `/api/agent/mobile/stream/*`                     |

### Resources

- `listResources()` returns **Method not found** — no resources exposed by this MCP server.

---

## Out-of-scope for MCP migration

The following capabilities remain outside the MCP client because the `@mobilenext/mobile-mcp@0.0.54` server does not expose tools for them:

- **`/api/agent/mobile/boot`** → Still uses `mobilecli` directly. No `mobile_boot_device` tool exists in the MCP server.
- **`/api/agent/mobile/logs`** → Uses `adb logcat` (Android) and `xcrun simctl spawn` (iOS) directly. No `mobile_stream_logs` tool exists.
- **`/api/agent/mobile/stream/*`** → Uses `serve-sim` independently. No `mobile_stream_screen` tool exists.

All three routes inherit the enhanced PATH set by the parent process (`app-server.ts` on Electron fork, or the shell otherwise) and do not hardcode OS-specific paths.
