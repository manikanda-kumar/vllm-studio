# 11 — CI workflow (GitHub Actions)

**Status:** `[ ]`
**Depends on:** 02, 04, 07
**Owner:** unassigned

## Goal

Run the test pyramid on every push + PR. Surface failures early. Cache aggressively for fast iteration.

## Context

- Repo: `manikanda-kumar/vllm-studio`, default branch `main`.
- No `.github/workflows/` yet.
- Tests span: vitest (fast), playwright browser (medium), playwright electron (slow, OS-sensitive), smoke.

## Instructions

1. Create `.github/workflows/test.yml`:
   ```yaml
   name: test
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]

   jobs:
     unit:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20', cache: 'npm', cache-dependency-path: 'frontend/package-lock.json' }
         - run: cd frontend && npm ci
         - run: cd frontend && npx tsc --noEmit
         - run: cd frontend && npm run lint
         - run: cd frontend && npm test

     controller:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: cd controller && npm ci && npm test

     e2e-browser:
       runs-on: ubuntu-latest
       needs: unit
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20', cache: 'npm', cache-dependency-path: 'frontend/package-lock.json' }
         - run: cd frontend && npm ci
         - run: cd frontend && npx playwright install --with-deps chromium
         - run: cd frontend && npm run build
         - run: cd frontend && npm run test:e2e
         - uses: actions/upload-artifact@v4
           if: always()
           with:
             name: playwright-browser
             path: frontend/test-artifacts/

     e2e-electron:
       runs-on: ${{ matrix.os }}
       needs: unit
       strategy:
         fail-fast: false
         matrix:
           os: [ubuntu-latest, macos-latest]
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: cd frontend && npm ci
         - run: cd frontend && npm run desktop:build
         - run: cd frontend && npx playwright install --with-deps
         - name: Electron e2e (linux/xvfb)
           if: runner.os == 'Linux'
           run: cd frontend && xvfb-run --auto-servernum npm run test:e2e:electron
         - name: Electron e2e (macos)
           if: runner.os == 'macOS'
           run: cd frontend && npm run test:e2e:electron
         - uses: actions/upload-artifact@v4
           if: always()
           with:
             name: playwright-electron-${{ matrix.os }}
             path: frontend/test-artifacts/
   ```
2. `fail-fast: false` everywhere so all jobs report.
3. Add a top-of-file status badge to `README.md` only if README exists at root (gitignore note: README.md exempted from *.md ignore per CLAUDE.md).
4. Concurrency group to cancel superseded runs:
   ```yaml
   concurrency:
     group: test-${{ github.ref }}
     cancel-in-progress: true
   ```
5. Set workflow `permissions: contents: read` (least privilege).

## Verification

Local dry-run:
```bash
# Validate YAML syntax
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/test.yml'))" && echo "PASS yaml-valid"

# Optionally use `act` if installed
act -l 2>/dev/null | grep -E "unit|e2e" && echo "PASS act-lists-jobs"
```

Real validation:
1. Push branch to GitHub.
2. Confirm 4 jobs (unit, controller, e2e-browser, e2e-electron×2) appear.
3. All green on a known-good commit.
4. Artifacts downloadable on failure.

## PASS criteria

- [ ] `.github/workflows/test.yml` exists, valid YAML
- [ ] Jobs: `unit`, `controller`, `e2e-browser`, `e2e-electron` (macOS + ubuntu)
- [ ] `fail-fast: false` on matrices
- [ ] `concurrency` block cancels superseded runs
- [ ] `permissions: contents: read`
- [ ] Artifacts uploaded on failure (playwright traces, screenshots)
- [ ] All jobs green on main after merge

## Notes
