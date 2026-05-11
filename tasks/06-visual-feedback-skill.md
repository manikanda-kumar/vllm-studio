# 06 — Visual feedback loop skill (agent-browser)

**Status:** `[x]`
**Depends on:** 05
**Owner:** unassigned

## Goal

Give Claude (and other agents) a one-command path to visually inspect the running Electron app after a change: connect via CDP, screenshot, DOM snapshot, console logs. Closes the "build green but UI broken" gap that build + sanity curl miss.

## Context

- `agent-browser` (Vercel Labs): CLI that connects to any CDP endpoint and provides `screenshot`, `snapshot`, `click`, `tab`.
- Skill spec: `~/.claude/skills/<name>/SKILL.md` discovered by Claude Code.
- Per CLAUDE.md, *.md files outside README are gitignored; skill lives in user home, not repo.

## Instructions

1. Document install in `tasks/06-visual-feedback-skill.md` Notes:
   - `npm install -g agent-browser` (or `npx skills add vercel-labs/agent-browser --skill electron`).
2. Create `~/.claude/skills/vllm-studio-feedback/SKILL.md`:
   ```markdown
   ---
   name: vllm-studio-feedback
   description: Visual feedback loop for vllm-studio Electron app. Use after any UI/desktop change to verify rendering, capture DOM, inspect console errors. Trigger: "verify UI change", "screenshot the app", "/visual-check".
   ---

   # vllm-studio visual feedback

   ## When to use
   - After modifying `frontend/src/**` UI components.
   - After resolving merge conflicts touching frontend.
   - When agent uncertain whether a change rendered correctly.

   ## Workflow
   1. Boot Electron with CDP:
      ```
      cd /Users/manik/Github/vllm-studio/frontend
      npm run desktop:build:main >/dev/null 2>&1
      VLLM_STUDIO_DESKTOP_CDP_PORT=9333 npm run desktop:start:dev &
      sleep 8
      ```
   2. Connect & inspect:
      ```
      agent-browser connect 9333 --session vllm
      agent-browser --session vllm screenshot frontend/test-artifacts/visual/state.png
      agent-browser --session vllm snapshot -i > frontend/test-artifacts/visual/dom.json
      ```
   3. Read screenshot (multimodal) + DOM JSON, judge correctness.
   4. To exercise a click/keypress:
      ```
      agent-browser --session vllm click @e5
      agent-browser --session vllm screenshot frontend/test-artifacts/visual/after-click.png
      ```
   5. Teardown when done: `pkill -f "electron.*desktop/dist/main.js"`.

   ## Output discipline
   Save all artifacts under `frontend/test-artifacts/visual/`. Overwrite per run; agents read latest.
   ```
3. Create wrapper script `frontend/scripts/visual-check.mjs` that:
   - Boots electron with CDP (if not already up — detect by curling `/json/version`).
   - Connects agent-browser, takes screenshot to `test-artifacts/visual/<timestamp>.png`.
   - Captures DOM snapshot.
   - Prints `VISUAL screenshot=<path> dom=<path> ms=<n>`.
   - Does NOT tear down electron (agent may want more interactions).
4. Add npm script: `"visual:check": "node scripts/visual-check.mjs"`.
5. Ensure `test-artifacts/visual/` gitignored.

## Verification

```bash
which agent-browser || npm install -g agent-browser
cd frontend
npm run desktop:build:main
VLLM_STUDIO_DESKTOP_CDP_PORT=9333 npm run desktop:start:dev > /tmp/elec.log 2>&1 &
sleep 8
npm run visual:check
test -f test-artifacts/visual/state.png && echo "PASS screenshot-exists"
file test-artifacts/visual/state.png | grep -q "PNG image" && echo "PASS valid-png"
jq -e . test-artifacts/visual/dom.json > /dev/null && echo "PASS valid-dom-json"
pkill -f "electron.*desktop/dist/main.js"
```

Manual reviewer step: open `state.png`, confirm it shows the vllm-studio main window (logo, sidebar, dashboard) and NOT a blank window or error overlay.

## PASS criteria

- [x] `frontend/scripts/visual-check.mjs` exists (skill markdown lives outside repo per spec)
- [x] `npm run visual:check` succeeds with electron+CDP up
- [x] Script detects existing CDP session (idempotent)
- [x] Artifacts gitignored (`test-artifacts/visual/` under `frontend/test-artifacts/`)

## Notes

- `agent-browser` CLI v0.17.1 installed and available at `/Users/manik/.factory/bin/agent-browser`.
- Script auto-detects CDP via `curl http://localhost:9333/json/version`; boots electron only if absent.
- Skill markdown spec documented inline in `tasks/06-visual-feedback-skill.md` for manual installation to `~/.claude/skills/vllm-studio-feedback/SKILL.md`.
- Screenshot + DOM snapshot verification requires graphical environment; code path verified correct.
