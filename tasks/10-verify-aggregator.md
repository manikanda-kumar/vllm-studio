# 10 — `npm run verify` aggregator + JSON reporter

**Status:** `[ ]`
**Depends on:** 02, 04
**Owner:** unassigned

## Goal

Single command runs the full fast feedback loop: typecheck → lint → unit → smoke. Emits a final aggregated PASS/FAIL line agents can grep. Target wall time <30s on warm machine when green.

## Context

- Currently no top-level verify command.
- Need to keep slow electron e2e out of this; that lives in pre-push (task 12) or CI.

## Instructions

1. Create `frontend/scripts/verify.mjs`:
   - Stages, in order:
     1. `tsc --noEmit` (typecheck)
     2. `eslint` (lint)
     3. `vitest run --passWithNoTests` (unit)
     4. `next build` (build) — only if `--full` flag, otherwise skip
     5. `node scripts/smoke.mjs` (smoke; auto-boot dev server if not running, tear down after)
   - Run sequentially, capture per-stage exit code + duration.
   - On failure: print stage's last 20 lines + final `FAIL verify stage=<name> ms=<n>`.
   - On success: print `PASS verify stages=<n> ms=<n>`.
   - Write `test-artifacts/verify.json` with structured results per stage.
2. Add npm script: `"verify": "node scripts/verify.mjs"`, `"verify:full": "node scripts/verify.mjs --full"`.
3. Smoke auto-boot logic:
   - Check `curl -s http://localhost:3210/` (2s timeout).
   - If down, `npm run dev` in background, wait until 200, run smoke, kill.
   - If up, reuse.
4. Reporter for vitest in this aggregator: `--reporter=json --outputFile=test-artifacts/vitest.json` so verify.mjs can parse counts.

## Verification

```bash
cd frontend
npm run verify
EXIT=$?
test $EXIT -eq 0 && echo "PASS verify-green-exit-0"
test -f test-artifacts/verify.json && jq '.stages | length' test-artifacts/verify.json
```

Expected output (green path):
```
[verify] typecheck ... PASS 1820ms
[verify] lint ... PASS 4210ms
[verify] unit ... PASS 6510ms count=47
[verify] smoke ... PASS 1230ms count=6
PASS verify stages=4 ms=13770
```

Failure injection:
```bash
# Introduce a TS error temporarily, confirm verify fails fast at typecheck stage with helpful output
echo "const x: number = 'string';" > frontend/src/__verify_break.ts
npm run verify; echo "exit=$?"
rm frontend/src/__verify_break.ts
```

Expected: exit non-zero, final line `FAIL verify stage=typecheck ms=<n>`, last error lines shown.

Wall-time target:
```bash
time npm run verify
```
Should be <30s on a warm machine. If consistently slower, document why in Notes.

## PASS criteria

- [ ] `npm run verify` runs typecheck → lint → unit → smoke
- [ ] Single greppable final line: `PASS verify ...` or `FAIL verify stage=<x> ...`
- [ ] `test-artifacts/verify.json` written with per-stage results
- [ ] Auto-boots dev server if not running; tears down on exit
- [ ] Failure at any stage halts pipeline and surfaces minimal error context
- [ ] Wall time <30s green, or documented exception
- [ ] `verify:full` variant includes `next build`

## Notes
