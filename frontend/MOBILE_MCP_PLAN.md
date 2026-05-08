# Mobile MCP Migration — Implementation Plan

Goal: replace the brittle, macOS-only `mobilecli`-spawn + hand-rolled JSON-RPC code with a single shared, stdio-based MCP client that works on macOS and Windows. Treat `boot`, `logs`, and `stream/*` as separate concerns from MCP migration.

Source of truth for current state: [frontend/CONTINUITY.md](file:///Users/manik/Github/vllm-studio/frontend/CONTINUITY.md).

---

## Conventions

- Each task lists **Scope**, **Changes**, **Verification**, **Done when**.
- Tasks are ordered. Earlier tasks must pass verification before later tasks start.
- Every task ends with one microcommit per [frontend/AGENTS.md](file:///Users/manik/Github/vllm-studio/frontend/AGENTS.md) ("micro: …").
- Never use `--no-verify`. Pre-commit hooks must pass.
- All cross-platform code MUST use `path.delimiter`, `path.sep`, `os.platform()`, never hardcoded `:` / `/` / `/opt/homebrew`.

---

## Task 0 — Capability discovery (DO FIRST)

**Scope**: Establish ground truth about what `@mobilenext/mobile-mcp` actually exposes. No production code changes.

**Changes**:
1. Pin a target version. Add to root `package.json` devDependencies (or a scratch script):
   ```bash
   npm i -D @mobilenext/mobile-mcp@<pin> @modelcontextprotocol/sdk
   ```
2. Create `frontend/scripts/probe-mobile-mcp.ts`:
   - Spawn `mobile-mcp` over **stdio** using `StdioClientTransport`.
   - Call `client.listTools()` and `client.listResources()`.
   - Print the JSON to stdout.
   - Exit non-zero if Node version < 22, mobile-mcp not resolvable, or transport handshake fails.
3. Document the result in a new section "Capability Matrix" at the bottom of [frontend/CONTINUITY.md](file:///Users/manik/Github/vllm-studio/frontend/CONTINUITY.md):
   - Tools available
   - Tools NOT available
   - Mapping → existing routes (devices/screenshot/tap/button vs boot/logs/stream)

**Verification**:
- `node -v` ≥ 22 → if not, document the requirement.
- `npx tsx frontend/scripts/probe-mobile-mcp.ts` returns a tool list with at minimum: `mobile_list_available_devices`, `mobile_take_screenshot`, `mobile_click_on_screen_at_coordinates`, `mobile_press_button`.
- The Capability Matrix is committed to `CONTINUITY.md`.

**Done when**: We have a written, version-pinned list of what the MCP server provides.

---

## Task 1 — Shared stdio MCP client (`mobile-mcp.ts` rewrite)

**Scope**: Replace [frontend/src/lib/mobile-mcp.ts](file:///Users/manik/Github/vllm-studio/frontend/src/lib/mobile-mcp.ts) with a correct, reusable, single-instance client.

**Changes**:
1. Delete the hand-rolled JSON-RPC code (port 3456, raw `POST /mcp`, broken initialize).
2. Use `Client` + `StdioClientTransport` from `@modelcontextprotocol/sdk`.
3. Singleton on `globalThis` (mirroring the `piRuntimeManager` pattern), to survive Next dev HMR.
4. **Start lock**: a `private starting: Promise<void> | null` so concurrent calls do not double-spawn.
5. **Reconnect on child exit**: on transport `close`, mark not-ready; next `ensureReady()` re-spawns.
6. Configurable spawn:
   - Resolve `mobile-mcp` binary via env override `VLLM_STUDIO_MOBILE_MCP_BIN`, else fall back to `npx` with **pinned** version (no `@latest`).
   - On Windows, the launcher must be `npx.cmd`.
   - PATH composition uses `path.delimiter`.
7. Typed wrappers: `listDevices`, `takeScreenshot`, `tap`, `pressButton`, `typeText`, `getScreenSize`, `listElements`. Each maps the MCP tool name discovered in Task 0.
8. Public health surface: `getHealth(): { ready, lastError, version, toolCount }`.

**Verification**:
- New unit test `frontend/src/lib/__tests__/mobile-mcp.test.ts` using a mock stdio MCP server (or an in-process `Server` from the SDK) that:
  - Two parallel `start()` calls produce one spawn (start-lock).
  - `tap()` after transport close auto-reconnects.
  - `getHealth()` reports `ready: false` until `initialize` completes.
- `npm run lint && npm run typecheck` clean.

**Done when**: `mobile-mcp.ts` no longer contains any HTTP, port number, hardcoded path, or `@latest`.

---

## Task 2 — Cross-platform spawn helper

**Scope**: Centralize PATH and binary-resolution logic so no other file hardcodes `/opt/homebrew/bin` or `:`.

**Changes**:
1. New `frontend/src/lib/system/spawn.ts`:
   - `enhancedPath(): string` — joins extra well-known dirs with `path.delimiter`. Conditional by `os.platform()`:
     - darwin: `/opt/homebrew/bin`, `/usr/local/bin`, `/opt/local/bin`
     - linux: `/usr/local/bin`, `/usr/bin`
     - win32: `%APPDATA%\npm`, `%ProgramFiles%\nodejs`
   - `resolveExecutable(name: string): string | null` — uses `which`/`where` semantics via Node's `fs.existsSync` walk.
   - `npxLauncher(): string` — returns `npx.cmd` on win32 else `npx`.
2. Refactor [frontend/desktop/logic/app-server.ts](file:///Users/manik/Github/vllm-studio/frontend/desktop/logic/app-server.ts) to call `enhancedPath()`.
3. Refactor [frontend/src/app/api/agent/mobile/boot/route.ts](file:///Users/manik/Github/vllm-studio/frontend/src/app/api/agent/mobile/boot/route.ts) to call `enhancedPath()`.
4. Audit `rg -n "/opt/homebrew|/usr/local/bin"` and remove all remaining hardcoded paths.

**Verification**:
- `rg -n '"\\:"|/opt/homebrew/bin' frontend` returns no matches in source files (only the helper).
- Unit test for `enhancedPath()` mocking `os.platform()` darwin/win32/linux returns expected delimiters and members.
- `npm run typecheck && npm run lint` clean.

**Done when**: There are zero hardcoded OS-specific paths or `:` separators outside `frontend/src/lib/system/spawn.ts`.

---

## Task 3 — Migrate MCP-backed API routes to the new client

**Scope**: `devices`, `screenshot`, `tap`, `button` only. Do NOT touch `boot`, `logs`, `stream/*`.

**Changes**:
1. Each route imports the shared client from `@/lib/mobile-mcp`:
   ```ts
   const client = await getMobileMcpClient().ensureReady();
   ```
2. Translate MCP `tools/call` errors into proper HTTP responses (400 for bad params, 503 for transport not ready, 500 for tool error).
3. Remove all per-route spawn helpers and PATH manipulation in these four files.
4. Replace silent `unavailable: true` shortcut with structured `{ error, code: "mobile_mcp_unavailable", health: <result of getHealth()> }`.

**Verification**:
- `curl http://localhost:3001/api/agent/mobile/devices` returns either `{ devices: [...] }` or a 503 with the health payload — never a stack trace.
- `curl ... /screenshot?device=<real id>` returns `image/png`.
- Manual test from the Mobile panel in the agent workspace: list, screenshot, tap, button all work end-to-end against a real Android emulator and an iOS simulator (mac).
- `rg "spawn\\(\\\"mobilecli" frontend/src/app/api/agent/mobile/{devices,screenshot,tap,button}` returns nothing.

**Done when**: Those four routes contain no `child_process` import.

---

## Task 4 — Pi-extension packaging fix

**Scope**: Stop shipping raw `.ts` and stop probing `process.cwd()`. Applies to BOTH `mobile.ts` and `browser.ts`.

**Changes**:
1. Add a build step in `frontend/package.json` (or extend the desktop build script) to compile `desktop/resources/pi-extensions/*.ts` to `.js` (e.g. via `tsx --build` or `esbuild`) emitted into `desktop/resources/pi-extensions/dist/`.
2. Include `desktop/resources/pi-extensions/dist/**` in Electron `extraResources` in `frontend/electron-builder.yml` (or equivalent).
3. In Electron main, after `app.whenReady()`, resolve the absolute paths and pass them to the spawned Next server via env:
   - `VLLM_STUDIO_PI_EXTENSION_MOBILE_PATH`
   - `VLLM_STUDIO_PI_EXTENSION_BROWSER_PATH`
4. In [frontend/src/lib/agent/pi-runtime.ts](file:///Users/manik/Github/vllm-studio/frontend/src/lib/agent/pi-runtime.ts):
   - `resolveMobileExtensionPath()` and `resolveBrowserExtensionPath()` use `process.env.VLLM_STUDIO_PI_EXTENSION_*_PATH` first.
   - Dev fallback ONLY if env unset AND `NODE_ENV !== "production"`: a single deterministic path relative to the repo (no `process.cwd()` waterfall).
5. Remove the `process.cwd()` candidate arrays.

**Verification**:
- `npm run desktop:build:main && npm run desktop:dist` produces a DMG/exe whose `Resources/` contains compiled `mobile.js` and `browser.js`.
- Launch the packaged app, open the Mobile panel, verify devices list (manual on mac; on Windows verify Android only).
- `rg "process.cwd" frontend/src/lib/agent/pi-runtime.ts` returns nothing.

**Done when**: The packaged app loads pi-extensions without depending on the source tree.

---

## Task 5 — Health & diagnostics surface

**Scope**: Replace silent failures with actionable, structured health.

**Changes**:
1. New route `frontend/src/app/api/agent/mobile/health/route.ts`:
   ```ts
   {
     nodeVersion: string,
     nodeVersionOk: boolean,        // ≥ 22
     npxFound: boolean,
     mobileMcpLaunchOk: boolean,
     mobileMcpVersion: string | null,
     adbFound: boolean,
     xcrunFound: boolean,
     serveSimFound: boolean,
     platform: "darwin"|"linux"|"win32",
     supportedFeatures: { devices, screenshot, tap, button, boot, logs, stream }
   }
   ```
2. Update [frontend/src/app/agent/_components/mobile-panel.tsx](file:///Users/manik/Github/vllm-studio/frontend/src/app/agent/_components/mobile-panel.tsx) to call `/api/agent/mobile/health` on mount and display:
   - Banner "Install Node 22+" if `!nodeVersionOk`
   - Banner "iOS device control requires macOS" on Windows
   - Per-feature greyed-out controls based on `supportedFeatures`

**Verification**:
- `curl /api/agent/mobile/health` returns the full payload on darwin and win32 (CI matrix).
- Mobile panel shows the correct banners when `mobile-mcp` is uninstalled (uninstall test).
- Manual test on Windows: panel renders, iOS sections greyed, Android works.

**Done when**: No code path returns `unavailable: true` silently.

---

## Task 6 — Lifecycle & graceful shutdown

**Scope**: Don't leak the `mobile-mcp` child process.

**Changes**:
1. In `mobile-mcp.ts`:
   - On `Client.transport.onclose`, set `ready=false` and clear singleton state.
   - Expose `stop()`.
2. Register signal handlers ONCE in [frontend/desktop/logic/app-server.ts](file:///Users/manik/Github/vllm-studio/frontend/desktop/logic/app-server.ts) for the spawned Next child:
   - `SIGTERM`, `SIGINT`, `beforeExit` → `await stopMobileMcp()`.
3. In Electron main, hook `app.on("before-quit")` → send IPC/signal to the Next child to stop the MCP.
4. NEVER use `process.on("exit", asyncFn)` — `exit` cannot await.

**Verification**:
- Start the Electron app; in another terminal `pgrep -f mobile-mcp` shows 1 process.
- Quit the app; `pgrep -f mobile-mcp` shows 0 within 5s.
- Repeat on Windows: `tasklist | findstr mobile-mcp` (or PowerShell `Get-Process`).
- No zombie children after 10 quit/relaunch cycles.

**Done when**: `pgrep -f mobile-mcp` is reliably empty after quit on both OSes.

---

## Task 7 — Drop runtime `@latest`, pin version

**Scope**: Eliminate behavior drift / offline failure.

**Changes**:
1. Add `@mobilenext/mobile-mcp` to `frontend/package.json` `optionalDependencies` (so install doesn't break if the host can't build it).
2. In `mobile-mcp.ts`, prefer launching the locally installed copy via `node ./node_modules/@mobilenext/mobile-mcp/dist/index.js` (resolved with `require.resolve` or `createRequire`).
3. Fallback chain: env override → resolved local copy → `npx` with explicit pinned version (not `@latest`).
4. Document the chosen version in `CONTINUITY.md`.

**Verification**:
- Disconnect from network, restart Electron, mobile panel still works (proves no `npx` network fetch).
- `rg "@latest" frontend` returns nothing in source files.

**Done when**: App launches mobile-mcp offline.

---

## Task 8 — Treat boot / logs / stream as separate work

**Scope**: Document, do not migrate yet.

**Changes**:
1. Add a new section "Out-of-scope for MCP migration" in `CONTINUITY.md` listing:
   - `/boot` → still `mobilecli` until mobile-mcp exposes a `boot_device` tool.
   - `/logs` → uses `adb logcat` / `xcrun simctl spawn` directly. Future: wrap in our own internal helper, not MCP.
   - `/stream/*` → `serve-sim`. Independent dependency, separate plan.
2. Apply the cross-platform spawn helper from Task 2 to `boot/route.ts` (no functional change, just remove hardcoded PATH).
3. Apply the same to logs/stream routes — paths only, no MCP.

**Verification**:
- `rg "/opt/homebrew" frontend/src/app/api/agent/mobile` returns nothing.
- `boot`, `logs`, `stream/*` all still work on macOS (manual smoke test).

**Done when**: All mobile API routes either use the MCP client OR `enhancedPath()`. Nothing hardcodes paths.

---

## Task 9 — Tests split by capability matrix

**Scope**: Realistic CI coverage.

**Changes**:
1. Unit/integration tests (run on every CI matrix entry):
   - `mobile-mcp.ts` start-lock, reconnect, error mapping (mock stdio server).
   - `enhancedPath()` per-platform.
   - `health` route returns expected shape.
2. Real-device smoke tests (manual or self-hosted runners):
   - macOS: iOS simulator + Android emulator
   - Windows: Android emulator only
3. Add `frontend/scripts/smoke-mobile.sh` that:
   - boots an Android emulator (`emulator -avd ...`)
   - waits for adb device
   - hits `/devices`, `/screenshot`, `/tap`, `/button`
   - asserts 200 and PNG signature on screenshot

**Verification**:
- CI green on darwin and win32 runners for unit tests.
- `bash frontend/scripts/smoke-mobile.sh` green on a dev machine with an emulator running.

**Done when**: Both unit and smoke tests pass on at least one mac and one Windows machine.

---

## Final acceptance gate

All of the following must be true:

- [ ] `rg -n '/opt/homebrew|"\\:"|@latest' frontend/src frontend/desktop` returns no source matches
- [ ] No `child_process` import in `devices/screenshot/tap/button/route.ts`
- [ ] `pgrep -f mobile-mcp` empty after quitting packaged app on both OSes
- [ ] Mobile panel works on packaged Electron app on macOS (iOS+Android) and Windows (Android)
- [ ] Health endpoint returns structured diagnostics; UI surfaces them
- [ ] CONTINUITY.md updated with capability matrix, pinned version, out-of-scope list
- [ ] All microcommits land with passing pre-commit hooks

---

## Risks called out

- **Node 22+ requirement**: existing users may be on older Node. Mitigation: prefer locally installed `mobile-mcp` over `npx`; document the prerequisite in README and surface in health UI.
- **iOS on Windows**: not supported. Health UI must communicate this; do not attempt.
- **`serve-sim` & `mobilecli` dependencies remain**: this plan does not eliminate them; it only stops their PATH bugs.
- **HMR in Next dev**: singleton must live on `globalThis` or HMR will leak children. Verified in Task 1.
