# 09 — Controller integration test (real HTTP)

**Status:** `[ ]`
**Depends on:** none
**Owner:** unassigned

## Goal

Boot the controller as a real HTTP server in a vitest spec, hit core endpoints, assert response shapes. Today the controller has unit tests for slices (`runtime-summary-events`, `tool-call-core`, `provider-routing`) but no full-stack assertion.

## Context

- Controller entry: `controller/src/main.ts`.
- Tests live in `controller/src/tests/`.
- DB: SQLite via `VLLM_STUDIO_CHATS_DB` env.
- Critical endpoints: `/health`, `/api/runtimes`, `/api/models`, `/api/inference/chat/completions` (proxied), `/api/agent/turn`.

## Instructions

1. Discover controller's HTTP framework (Hono? Express? Fastify?) — read `controller/src/main.ts` first 60 lines. Likely Hono based on repo style. Use that framework's test client if it has one; otherwise spin a real listener on a random port.
2. Create `controller/src/tests/http-integration.test.ts`:
   ```ts
   import { describe, test, expect, beforeAll, afterAll } from 'vitest';
   import { mkdtemp, rm } from 'node:fs/promises';
   import { tmpdir } from 'node:os';
   import path from 'node:path';
   // import boot helper from controller — refactor main.ts to export `createApp()` if not already.

   describe('controller HTTP', () => {
     let dbDir: string;
     let server: { url: string; close: () => Promise<void> };

     beforeAll(async () => {
       dbDir = await mkdtemp(path.join(tmpdir(), 'vllm-ctl-'));
       process.env.VLLM_STUDIO_CHATS_DB = path.join(dbDir, 'chats.db');
       server = await startTestServer({ port: 0 });   // 0 = pick free port
     });

     afterAll(async () => {
       await server.close();
       await rm(dbDir, { recursive: true, force: true });
     });

     test('GET /health returns ok', async () => {
       const r = await fetch(`${server.url}/health`);
       expect(r.status).toBe(200);
       const body = await r.json();
       expect(body).toHaveProperty('status');
     });

     test('GET /api/runtimes returns array', async () => {
       const r = await fetch(`${server.url}/api/runtimes`);
       expect(r.status).toBe(200);
       const body = await r.json();
       expect(Array.isArray(body.runtimes ?? body)).toBe(true);
     });

     // ... more
   });
   ```
3. If `main.ts` doesn't expose a programmatic boot, refactor:
   - Export `export async function createApp(): Promise<App>`
   - Export `export async function startTestServer(opts?: { port?: number }): Promise<{ url, close }>`.
   - Keep `if (import.meta.main)` or equivalent so direct `node main.js` still works.
4. Tests must NOT touch user's real DB. Always use `mkdtemp`.
5. Tests must NOT spawn engines/inference subprocesses. Mock or short-circuit any path that would.

## Verification

```bash
cd controller
npm test -- src/tests/http-integration.test.ts
```

Expected: all assertions pass in <5s. No leftover processes (`pgrep -f "controller/dist" | wc -l` returns 0). Temp DB directory cleaned (`ls /tmp/vllm-ctl-*` empty).

Repeat run:
```bash
for i in 1 2 3; do npm test -- src/tests/http-integration.test.ts || exit 1; done
echo "PASS no-flake-3x"
```

## PASS criteria

- [ ] `createApp()` / `startTestServer()` factored and exported
- [ ] At least 3 endpoint assertions: `/health`, `/api/runtimes`, one POST/mutation
- [ ] Random port (no 8080 conflict)
- [ ] Temp DB per test run, cleaned up after
- [ ] No real inference engines spawned
- [ ] Runs in <5s
- [ ] No flakes across 3 runs

## Notes

(framework discovery result + refactor diff summary here)
