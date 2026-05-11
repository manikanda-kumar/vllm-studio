# 07 — Electron `_electron` Playwright spec

**Status:** `[ ]`
**Depends on:** 05
**Owner:** unassigned

## Goal

Run real Electron in CI/local using Playwright's built-in `_electron.launch()` API. Verify desktop shell boots, mainWindow visible, navigation works inside the electron renderer, IPC handlers respond.

## Context

- Playwright ships with `_electron` test fixture (no Spectron needed).
- Electron entry: `frontend/desktop/dist/main.js` (compiled output).
- IPC handlers registered in `registerIpcHandlers()` inside `main.ts`. Identify which channels exist (`getDesktopAppState`, `getProjects`, `addProject`, `checkForUpdates` — confirm by inspection).

## Instructions

1. Create `frontend/tests/electron/app-boot.spec.ts`:
   ```ts
   import { test, expect, _electron as electron } from '@playwright/test';
   import path from 'node:path';

   test.describe('electron shell', () => {
     test('boots and shows main window', async () => {
       const app = await electron.launch({
         args: [path.join(__dirname, '../../desktop/dist/main.js')],
         env: { ...process.env, VLLM_STUDIO_DESKTOP_DEV_SERVER_URL: '' },
         timeout: 30_000,
       });
       const win = await app.firstWindow();
       await expect(win).toHaveTitle(/vllm.studio/i);
       await win.screenshot({ path: 'test-artifacts/07-electron/boot.png' });
       await app.close();
     });

     test('responds to getDesktopAppState IPC', async () => {
       const app = await electron.launch({ args: [...] });
       const state = await app.evaluate(async ({ ipcMain }) => {
         // Use the actual IPC channel; replace with real one after inspecting main.ts
       });
       expect(['starting', 'ready']).toContain(state);
       await app.close();
     });
   });
   ```
2. Update `playwright.config.ts` to add a separate project:
   ```ts
   projects: [
     { name: 'browser', testDir: './tests/e2e' },
     { name: 'electron', testDir: './tests/electron', timeout: 120_000 },
   ]
   ```
3. Add npm script: `"test:e2e:electron": "playwright test --project=electron"`.
4. Pre-test hook: ensure `desktop/dist/main.js` is fresh. Add `globalSetup: "tests/electron/setup.ts"` that runs `npm run desktop:build:main` if dist stale.
5. CI hint: Electron e2e on Linux needs `xvfb-run`. Document in task notes.

## Verification

```bash
cd frontend
npm run desktop:build:main
npm run test:e2e:electron
test -f test-artifacts/07-electron/boot.png && echo "PASS screenshot"
```

Expected: 2 specs pass. Final line `PASS test:e2e count=2 ms=<n>`.

Flake check:
```bash
for i in 1 2 3; do npm run test:e2e:electron || exit 1; done
echo "PASS no-flake-3x"
```

## PASS criteria

- [ ] Electron launches programmatically without manual `app.quit()` hangs
- [ ] Main window title matches
- [ ] At least one real IPC channel exercised
- [ ] Boot screenshot saved as PNG
- [ ] Playwright projects split into `browser` and `electron`
- [ ] No flakes across 3 runs
- [ ] Test cleanup: no orphan Electron processes after run (`pgrep -f "desktop/dist/main.js" | wc -l` returns 0)

## Notes

(real IPC channel names go here once confirmed)
