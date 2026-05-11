# 01 — Bootstrap Playwright browser e2e harness

**Status:** `[x]`
**Depends on:** none
**Owner:** unassigned

## Goal

Wire Playwright so it can run browser specs against a running `next dev` instance with deterministic startup. Today `playwright.config.ts` points at `./tests` but the directory does not exist.

## Context

- Existing: `frontend/playwright.config.ts` (uses env `PLAYWRIGHT_BASE_URL`, default `http://localhost:3000`).
- Frontend dev port may conflict; tests must use isolated port.
- Reporter currently `html` + `list`. Needs JSON reporter for agent consumption.

## Instructions

1. Create directory `frontend/tests/e2e/` with `.gitkeep`.
2. Create directory `frontend/test-artifacts/` and add to `.gitignore` (extend root `.gitignore`).
3. Update `frontend/playwright.config.ts`:
   - Add `webServer` block that runs `npm run dev` with `PORT=3210`, waits on `http://localhost:3210`, reuses if already running locally (`reuseExistingServer: !process.env.CI`).
   - Change default `baseURL` to `http://localhost:3210`.
   - Add JSON reporter: `[["json", { outputFile: "test-artifacts/results.json" }], ["line"], ["html", { open: "never", outputFolder: "test-artifacts/playwright-report" }]]`.
   - Set `outputDir: "test-artifacts/playwright-output"`.
4. Create `frontend/tests/e2e/_smoke.spec.ts` — single assertion `expect(true).toBe(true)` — pure harness check.
5. Add npm scripts in `frontend/package.json`:
   - `"test:e2e": "playwright test"`
   - `"test:e2e:ui": "playwright test --ui"`
   - `"test:e2e:install": "playwright install --with-deps chromium"`
6. Add `tests/README.md` documenting how to run locally (env vars, prerequisites).

## Verification

Run from `frontend/`:

```bash
npx playwright install --with-deps chromium     # first time only
npm run build                                    # ensure no break
npm run test:e2e -- --reporter=line              # should run and pass _smoke
test -f test-artifacts/results.json && echo "PASS json reporter"
test -d test-artifacts/playwright-report && echo "PASS html report"
```

Expected final lines:
```
PASS test:e2e count=1 ms=<n>
PASS json reporter
PASS html report
```

Then verify reuse logic — run with dev server already up on 3210:
```bash
PORT=3210 npm run dev &
DEV_PID=$!
sleep 5
npm run test:e2e
kill $DEV_PID
```

Must NOT spawn a second dev server.

## PASS criteria

- [ ] `frontend/tests/e2e/` exists with `.gitkeep` + `_smoke.spec.ts`
- [ ] `playwright.config.ts` has webServer, JSON reporter, port 3210
- [ ] `test-artifacts/` gitignored; appears after run
- [ ] `npm run test:e2e` exits 0 with passing smoke test
- [ ] `results.json` parseable: `jq '.suites[0].specs[0].title' test-artifacts/results.json` returns spec title
- [ ] Re-running with existing dev server reuses (no port conflict)
- [ ] No lint/type errors: `npm run lint` clean, `npx tsc --noEmit` clean for new files

## Notes

- `testDir` updated from `./tests` to `./tests/e2e` to align with the file structure.
- `baseURL` default changed from `http://localhost:3000` to `http://localhost:3210`.
- Added `tests/README.md` with local run instructions and env vars.
- Verification: `npm run test:e2e` exits 0 with 8 passing tests (1 harness + 7 app-shell). `results.json` and `playwright-report/` generated successfully.
