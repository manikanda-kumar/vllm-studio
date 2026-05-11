# 02 — Browser smoke spec: app shell + routes

**Status:** `[x]`
**Depends on:** 01
**Owner:** unassigned

## Goal

First real e2e spec. Asserts the app shell renders, primary routes are reachable from sidebar, no client-side console errors on navigation. Catches "build passes but UI broken" class today.

## Context

Routes (post-merge with upstream):
- `/` (Status / dashboard)
- `/usage`
- `/agent`
- `/recipes` (Models)
- `/logs`
- `/settings` (was `/configs`; `/configs` now 307 → `/settings`)

Sidebar: `frontend/src/components/left-sidebar.tsx`. Lite mode hides Status/Usage/Models/Logs.

## Instructions

1. Create `frontend/tests/e2e/app-shell.spec.ts`.
2. Specs:
   - **`renders dashboard`** — visit `/`, assert sidebar logo visible, no `console.error` on page, screenshot saved.
   - **`navigates to each top-level route`** — for each of `/agent`, `/recipes`, `/logs`, `/settings`, `/usage`: click sidebar link, assert URL changes, assert main content has a stable `data-testid` or heading text, no console errors.
   - **`legacy /configs redirects to /settings`** — `page.goto('/configs')`, assert final URL is `/settings`.
3. Add minimal `data-testid` attributes ONLY where there is no stable heading text already. Keep additions <5.
4. Console error capture pattern:
   ```ts
   const errors: string[] = [];
   page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
   test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));
   ```
   Allow-list any pre-existing benign errors (e.g. websocket retry) via `errors.filter(e => !e.includes('benign-substring'))`. Document each allow in inline comment with reason.
5. Screenshots: save to `test-artifacts/02-shell/<route>.png` on success too (not just failure), so visual feedback loop can read them.

## Verification

From `frontend/`:

```bash
npm run test:e2e -- tests/e2e/app-shell.spec.ts
ls test-artifacts/02-shell/
jq '.stats.expected' test-artifacts/results.json   # should be >= 7
```

Expected final line: `PASS test:e2e count=<n> ms=<n>` with n ≥ 7 (5 routes + dashboard + redirect).

Re-run 3× to confirm no flake:
```bash
for i in 1 2 3; do npm run test:e2e -- tests/e2e/app-shell.spec.ts || exit 1; done
echo "PASS no-flake-3x"
```

## PASS criteria

- [x] All specs in `app-shell.spec.ts` green
- [x] Console error allow-list documented with reasons
- [x] Screenshots saved per route under `test-artifacts/02-shell/`
- [x] Redirect `/configs` → `/settings` asserted
- [x] No flakes across 3 runs
- [x] Added `data-testid` count ≤ 5; each justified
- [x] No lint/type errors

## Notes

- Added `data-testid="agent-page"` to `AgentWorkspace` root (1 attribute, justified: no stable heading text).
- Lite mode is default `true` in the store; tests explicitly disable it via `localStorage.setItem` in `beforeEach` so all sidebar links are visible.
- Console allow-list covers: WebSocket retry, ResizeObserver loop, 404 resource errors, EventSource MIME type mismatch, and JSON parse errors from `/api/*` endpoints when controller is absent. Each documented with inline comment.
- Screenshots saved per route under `test-artifacts/02-shell/`.
- 3× flake check passed consistently (14–18s per run).
- Lint clean; no new TypeScript errors in new files.

### Review — 2026-05-11T08:19Z (auto)

- ✅ `frontend/tests/e2e/app-shell.spec.ts` exists
- ✅ Screenshots dir `test-artifacts/02-shell/` created
- ✅ Console allow-list documented inline (WebSocket retry, ResizeObserver, 404s, EventSource MIME, JSON parse)
- ✅ Lite-mode reset in beforeEach noted (default `true` in store — easy regression source, well caught)
- ✅ `data-testid` additions = 1 (under cap of 5)
- ✅ 3× flake check passed
- **PASS confirmed.** Watch for: if controller comes online in CI, allow-list entries for JSON parse on `/api/*` may need narrowing.
