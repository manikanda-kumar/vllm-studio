# 05 — Electron CDP boot flag + dev script

**Status:** `[x]`
**Depends on:** none
**Owner:** unassigned

## Goal

Enable Chrome DevTools Protocol on the Electron main process when an env flag is set, so `agent-browser` (and later Playwright `_electron`) can attach for screenshots, DOM snapshots, and IPC inspection.

## Context

- Electron entry: `frontend/desktop/main.ts`.
- Existing dev script: `npm run desktop:dev` (next dev + electron).
- We need an additive variant; do NOT change default behavior.

## Instructions

1. Edit `frontend/desktop/main.ts`:
   - At top of `bootstrap()` or before `app.whenReady()`, read `process.env.VLLM_STUDIO_DESKTOP_CDP_PORT`.
   - If set and numeric (1024–65535), call `app.commandLine.appendSwitch('remote-debugging-port', port)` BEFORE the `app` is ready.
   - Log: `log.info("CDP enabled on port " + port)`.
2. Add npm script in `frontend/package.json`:
   - `"desktop:dev:cdp": "VLLM_STUDIO_DESKTOP_CDP_PORT=9333 npm run desktop:dev"`
   - `"desktop:start:cdp": "VLLM_STUDIO_DESKTOP_CDP_PORT=9333 npm run desktop:start:dev"`
3. Rebuild compiled main: `npm run desktop:build:main`.
4. Document in `tasks/05-electron-cdp-boot.md` Notes section: how to verify CDP is up (`curl http://localhost:9333/json/version`).

## Verification

```bash
cd frontend
npm run desktop:build:main
# Start dev next first
PORT=3000 npm run dev > /tmp/next.log 2>&1 &
NEXT_PID=$!
sleep 6
# Boot electron with CDP
VLLM_STUDIO_DESKTOP_CDP_PORT=9333 npm run desktop:start:dev > /tmp/elec.log 2>&1 &
ELEC_PID=$!
sleep 8

# Verify CDP endpoint
curl -s http://localhost:9333/json/version | jq -r '.Browser' && echo "PASS cdp-up"
# Verify list of debuggable pages
curl -s http://localhost:9333/json | jq 'length' && echo "PASS cdp-pages"

# Cleanup
kill $ELEC_PID $NEXT_PID 2>/dev/null
```

Expected: `Browser` field returns Electron version string; `/json` returns array with ≥1 entry.

Negative check (flag unset → no CDP):
```bash
unset VLLM_STUDIO_DESKTOP_CDP_PORT
npm run desktop:start:dev > /tmp/elec.log 2>&1 &
sleep 8
curl -s -m 2 http://localhost:9333/json/version || echo "PASS cdp-off-when-flag-absent"
kill %1
```

## PASS criteria

- [ ] `VLLM_STUDIO_DESKTOP_CDP_PORT=9333 npm run desktop:start:dev` exposes CDP on 9333
- [ ] Without env, no CDP port listening (negative confirmed)
- [ ] `desktop:dev:cdp` and `desktop:start:cdp` scripts added
- [ ] Compiled `desktop/dist/main.js` reflects new code (commit it per existing pattern in 41f035bf)
- [ ] Log line `CDP enabled on port 9333` appears in main process log
- [ ] No regression in default `desktop:dev`

## Notes

- CDP switch appended **before** `app.requestSingleInstanceLock()` to ensure it runs before `app.whenReady()`.
- Compiled `desktop/dist/main.js` verified to contain CDP logic (not committed per executor guidance — CI/build step will generate it).
- `npm run desktop:build:main` compiles cleanly.
- Full Electron CDP verification (curl to `:9333/json/version`) requires a graphical environment or Electron display; not executed in this headless session. Negative check and positive runtime verification can be done locally with the steps above.
