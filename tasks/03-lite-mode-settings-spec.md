# 03 — Lite-mode + settings e2e spec

**Status:** `[ ]`
**Depends on:** 02
**Owner:** unassigned

## Goal

Cover the two features most likely to regress from the merge we just resolved:
1. Lite-mode toggle (filters sidebar tabs + settings sections).
2. Settings persistence (Default model, API key masked store, theme/font changes).

## Context

- Lite-mode state in `useAppStore` (`s.liteMode`, `s.setLiteMode`).
- Sidebar filters `allTabs` by `liteMode` field. Settings filter `SECTIONS` by `LITE_SECTION_IDS`.
- Interface Mode toggle lives in `frontend/src/app/configs/_components/appearance-settings.tsx`.
- API connection section in `frontend/src/app/configs/_components/api-connection-section.tsx` includes new "Default model" row.

## Instructions

1. Create `frontend/tests/e2e/lite-mode.spec.ts`:
   - **`full mode shows all 6 tabs`** — fresh state, assert sidebar shows Status/Usage/Agent/Models/Logs/Settings.
   - **`lite mode hides infra tabs`** — visit `/settings#appearance`, click "Lite (Agent)" segmented option, assert sidebar shows only Agent + Settings.
   - **`lite mode hides infra settings sections`** — within `/settings` in lite mode, only `connection / providers / appearance / agent` sections visible in `SettingsLayout` nav.
   - **`mode persists across reload`** — toggle lite, `page.reload()`, assert still lite.
   - **`switching back to full restores tabs`** — toggle to Full, assert all 6 sidebar entries back.

2. Create `frontend/tests/e2e/settings-persistence.spec.ts`:
   - **`default model saves and re-loads`** — fill input with `openai/gpt-4o`, click Save, reload, assert value persists.
   - **`api key store status flips from unset → stored`** — fill API key, save, assert `StatusPill` text changes to `stored`, key field shows mask `••••••••` on reload.
   - **`reveal/hide API key toggles input type`** — click eye icon, assert `<input type="text">`, click again → `password`.
   - **`theme change applies CSS variable`** — pick non-default theme, assert `document.documentElement.style.getPropertyValue('--bg')` value changes.

3. Reset persistence between tests:
   ```ts
   test.beforeEach(async ({ page }) => {
     await page.addInitScript(() => {
       window.localStorage.clear();
       indexedDB?.databases?.().then((dbs) => dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name)));
     });
   });
   ```

4. For API-key save: stub the controller PUT endpoint with `page.route('**/api/settings', ...)` returning 200 so spec does not require live backend.

## Verification

```bash
npm run test:e2e -- tests/e2e/lite-mode.spec.ts tests/e2e/settings-persistence.spec.ts
```

Expected: 9 specs PASS. Final line `PASS test:e2e count=9 ms=<n>`.

Flake check:
```bash
for i in 1 2 3; do npm run test:e2e -- tests/e2e/lite-mode.spec.ts tests/e2e/settings-persistence.spec.ts || exit 1; done
echo "PASS no-flake-3x"
```

## PASS criteria

- [ ] 5 lite-mode specs + 4 settings specs green
- [ ] localStorage cleared per test (no cross-spec contamination)
- [ ] API save mocked via `page.route`; spec independent of controller
- [ ] No flakes across 3 runs
- [ ] No lint/type errors

## Notes
