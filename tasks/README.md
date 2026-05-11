# Automation Test Strategy — Task Plan

Multi-layer feedback loop for vllm-studio. Each task self-contained: goal, instructions, verification, PASS criteria. Subagent executes; reviewer (Claude or human) verifies and marks PASS.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[?]` Awaiting review
- `[x]` PASS
- `[!]` BLOCKED / FAIL — see Notes

## Task index (recommended execution order)

| # | Task | File | Status | Depends on |
|---|------|------|--------|-----------|
| 01 | Bootstrap Playwright browser e2e harness | [01-playwright-browser-harness.md](01-playwright-browser-harness.md) | `[x]` | — |
| 02 | Browser smoke spec — app shell + routes | [02-browser-smoke-spec.md](02-browser-smoke-spec.md) | `[x]` | 01 |
| 03 | Lite-mode + settings e2e spec | [03-lite-mode-settings-spec.md](03-lite-mode-settings-spec.md) | `[x]` | 02 |
| 04 | Smoke script with agent-parseable output | [04-smoke-script.md](04-smoke-script.md) | `[x]` | — |
| 05 | Electron CDP boot flag + dev script | [05-electron-cdp-boot.md](05-electron-cdp-boot.md) | `[x]` | — |
| 06 | Visual feedback loop skill (agent-browser) | [06-visual-feedback-skill.md](06-visual-feedback-skill.md) | `[x]` | 05 |
| 07 | Electron `_electron` Playwright spec | [07-electron-e2e-spec.md](07-electron-e2e-spec.md) | `[x]` | 05 |
| 08 | Mobile MCP regression spec | [08-mobile-mcp-spec.md](08-mobile-mcp-spec.md) | `[x]` | 02 |
| 09 | Controller integration test (real HTTP) | [09-controller-integration.md](09-controller-integration.md) | `[x]` | — |
| 10 | `npm run verify` aggregator + JSON reporter | [10-verify-aggregator.md](10-verify-aggregator.md) | `[x]` | 02, 04 |
| 11 | CI workflow (GitHub Actions) | [11-ci-workflow.md](11-ci-workflow.md) | `[ ]` | 02, 04, 07 |
| 12 | Pre-push hook wiring | [12-pre-push-hook.md](12-pre-push-hook.md) | `[ ]` | 10 |

## Cross-cutting conventions

All tasks MUST follow these. Subagents read this section first.

### Output discipline (feedback loop)

- Every script/test runner emits a **terse final line** parsable by Claude. Format: `PASS scope=<name> count=<n> ms=<n>` or `FAIL scope=<name> file=<path> reason="<short>"`.
- Screenshots/artifacts go under `frontend/test-artifacts/<task-id>/<name>.png` — stable paths, gitignored.
- Playwright reporters: `[["json", { outputFile: "test-artifacts/results.json" }], ["line"]]` so agents grep JSON not scrollback.
- Vitest: rely on default reporter for humans; `--reporter=json --outputFile=...` when invoked by scripts.

### Test isolation

- Controller integration tests use isolated DB via env: `VLLM_STUDIO_CHATS_DB=$(mktemp -t vllm-XXXX.db)`. Cleanup in `afterAll`.
- Playwright `webServer` boots controller + frontend on **random free ports** (not 3000/8080). Tests read URLs from env.
- No shared mutable state between specs. Each spec resets store + localStorage in `beforeEach`.

### File locations

- Browser e2e: `frontend/tests/e2e/*.spec.ts`
- Electron e2e: `frontend/tests/electron/*.spec.ts`
- Smoke + utility scripts: `frontend/scripts/`
- Test artifacts (gitignored): `frontend/test-artifacts/`

### Definition of PASS

A task is PASS only when ALL of:
1. Verification commands listed in task file run green from clean checkout.
2. No new lint/type errors introduced (`npm run lint` + `tsc --noEmit` clean for new files).
3. New tests are deterministic — re-run 3× without flakes.
4. Artifacts (screenshots, JSON) land at documented paths.
5. Reviewer confirms approach matches task spec (no scope creep, no premature abstraction).

If any check fails: mark `[!]`, document failure under `## Notes` in task file, do not move forward in dependency chain.

### Review protocol

1. Subagent finishes task, sets status to `[?]` and commits work on a branch `tasks/<NN>-<slug>`.
2. Reviewer pulls branch, runs verification commands, inspects diff.
3. PASS → reviewer sets `[x]`, merges to main. FAIL → sets `[!]`, leaves comments.
4. Status table in this README is the source of truth.
