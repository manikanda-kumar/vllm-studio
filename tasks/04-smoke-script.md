# 04 — Smoke script with agent-parseable output

**Status:** `[x]`
**Depends on:** none
**Owner:** unassigned

## Goal

Replace ad-hoc `curl` invocations with a deterministic Node script that probes critical HTTP routes + writes a single-line PASS/FAIL summary per route. Used by `npm run verify` and CI; also runnable on demand for quick reality checks.

## Context

- Routes today: `/`, `/agent`, `/settings`, `/configs` (redirect 307), `/api/agent/mobile/health`, `/api/settings`, `/api/agent/projects`.
- Frontend port: configurable via env, default 3210.
- Output must be greppable: `PASS route=/agent status=200 ms=12` or `FAIL route=/x status=500 ms=8 reason="..."`.

## Instructions

1. Create `frontend/scripts/smoke.mjs`:
   ```js
   #!/usr/bin/env node
   // node-only, no deps. Use built-in fetch.
   const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3210';
   const routes = [
     { path: '/', expect: 200 },
     { path: '/agent', expect: 200 },
     { path: '/settings', expect: 200 },
     { path: '/configs', expect: 307, redirect: 'manual' },
     { path: '/api/agent/projects', expect: 200 },
     { path: '/api/agent/mobile/health', expect: [200, 503] },  // 503 acceptable when mobile-mcp absent
   ];
   // ... fetch each, time it, print one line per route, exit non-zero if any FAIL.
   ```
2. Output format strict:
   - One line per route.
   - Final summary line: `SMOKE pass=<n> fail=<n> total=<n> ms=<n>`.
   - Exit code 0 only if all routes pass.
3. Add npm script: `"smoke": "node scripts/smoke.mjs"`.
4. Support `--json` flag → emit JSON array instead of lines, write to `test-artifacts/smoke.json`.
5. Add `--base-url <url>` flag override env.
6. Handle connection refused gracefully → `FAIL route=/ status=conn-refused ms=<n> reason="server not running"` then exit 2 (distinguish from HTTP failures).

## Verification

Start dev server, run smoke:
```bash
cd frontend
PORT=3210 npm run dev > /tmp/dev.log 2>&1 &
PID=$!
sleep 6
npm run smoke
EXIT=$?
kill $PID
test $EXIT -eq 0 && echo "PASS smoke-exit-0"
```

Expected output:
```
PASS route=/ status=200 ms=...
PASS route=/agent status=200 ms=...
PASS route=/settings status=200 ms=...
PASS route=/configs status=307 ms=...
PASS route=/api/agent/projects status=200 ms=...
PASS route=/api/agent/mobile/health status=503 ms=...
SMOKE pass=6 fail=0 total=6 ms=...
```

JSON mode:
```bash
npm run smoke -- --json
test -f test-artifacts/smoke.json && jq '. | length' test-artifacts/smoke.json
```

Failure mode (server down):
```bash
npm run smoke; echo "exit=$?"   # exit=2
```

## PASS criteria

- [ ] `scripts/smoke.mjs` exists, zero deps beyond node built-ins
- [ ] Per-route line format matches spec exactly (greppable)
- [ ] Summary line emitted last
- [ ] `--json` writes valid JSON to `test-artifacts/smoke.json`
- [ ] Exit codes: 0 all pass, 1 HTTP fail, 2 connection refused
- [ ] Runs in <2s when server up
- [ ] No new deps in `package.json`

## Notes

- Script uses zero deps beyond Node built-ins (`fetch`, `fs/promises`, `performance`).
- `/api/agent/mobile/health` returned 200 in verification (mobile-mcp was present), but script accepts `[200, 503]` as specified.
- JSON mode writes structured output to `test-artifacts/smoke.json` with both per-route results and summary.
- Connection refused returns exit code 2 as specified.
- Runs in ~0.5s when server is up.
