# Continuity Ledger

## Goal
Add mobile app testing support to vllm-studio for use as a coding agent with mobile development projects.

**Success criteria:**
- Agent workspace has Mobile panel for device control
- Agent can build, install, test mobile apps via Bash + mobilecli
- Visual feedback via live streaming or screenshot refresh
- Zero context overhead (no MCP tools, use AGENTS.md for CLI docs)

## Constraints/Assumptions
- vLLM models have ~90k context → avoid MCP tool overhead
- Use mobilecli (npm) as unified device control layer
- serve-sim (optional) for iOS 60fps streaming
- Android uses auto-refresh polling (1fps)
- macOS required for iOS simulator testing

## Key Decisions
1. **No MCP integration** — context too expensive. Agent uses Bash + mobilecli commands documented in AGENTS.md
2. **mobilecli over raw adb/simctl** — unified cross-platform CLI, JSON output
3. **serve-sim for iOS streaming** — MJPEG + WebSocket touch, fallback to auto-refresh if unavailable
4. **Mobile Panel is display-only** — no tool overhead, just visual feedback for human

## State

### Done
- [x] Research mobile testing approaches (RESEARCH_PLAN.md in tools/projects/mobile-app-testing)
- [x] Created Mobile Panel component (`frontend/src/app/agent/_components/mobile-panel.tsx`)
- [x] Added Mobile tab to agent workspace Computer panel
- [x] API routes for device control:
  - `/api/agent/mobile/devices` - list devices
  - `/api/agent/mobile/screenshot` - capture screen
  - `/api/agent/mobile/tap` - tap at x,y
  - `/api/agent/mobile/button` - press HOME/BACK/etc
  - `/api/agent/mobile/logs` - fetch device logs
  - `/api/agent/mobile/boot` - boot offline device
  - `/api/agent/mobile/stream/start` - start serve-sim
  - `/api/agent/mobile/stream/stop` - stop serve-sim
- [x] Updated AGENTS.md in android-vllm-chat with mobilecli commands
- [x] Committed and pushed to manikanda-kumar/vllm-studio (d724af5c)
- [x] Added lite mode (default ON) - hides vLLM infra tabs for agent-desktop-only use:
  - `app-store.ts`: added `liteMode` state (persisted)
  - `left-sidebar.tsx`: filters nav tabs, hides model stop button in lite mode
  - `configs-tab-bar.tsx`: shows only Connection/Providers/Appearance in lite mode
  - `appearance-settings.tsx`: added Interface Mode toggle (Lite vs Full)
  - `page.tsx`: redirects `/` to `/agent` in lite mode

### Now
- Lite mode implementation complete

### Next
- [ ] Test mobile panel with real emulator/simulator
- [ ] Install mobilecli + serve-sim dependencies
- [ ] Verify agent can use mobilecli via Bash tool
- [ ] Add Maestro integration for UI automation flows
- [ ] Consider VLM-based visual verification (Qwen3-8B-VL)

## Open Questions
- Does pi runtime need any config to allow mobilecli/serve-sim commands?
- Should logs panel stream via SSE instead of polling?

## Working Set
- `frontend/src/app/agent/_components/mobile-panel.tsx`
- `frontend/src/app/agent/_components/agent-workspace.tsx`
- `frontend/src/app/api/agent/mobile/*`
- `/Users/manik/Github/tools/projects/mobile-app-testing/android-vllm-chat/AGENTS.md`

## Project Learnings
- vllm-studio uses `pi` (pi.dev) as coding agent runtime with RPC
- pi supports extensions (browser.ts pattern) but MCP adds context overhead
- mobilecli provides unified iOS+Android control, JSON output
- serve-sim enables 60fps iOS streaming with WebSocket touch control
- Agent workspace has Browser/Files/Diff/Mobile tabs in Computer panel
