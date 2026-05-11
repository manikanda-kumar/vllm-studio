# E2E Tests

## Prerequisites

```bash
npm run test:e2e:install   # install Playwright browsers + deps
```

## Running locally

```bash
npm run test:e2e           # run all e2e tests (headless)
npm run test:e2e:ui        # run with Playwright UI mode
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3210` | Frontend base URL |
| `PLAYWRIGHT_BACKEND_URL` | — | Controller API URL (for isolated DB tests) |

## Isolation

The Playwright config spins up its own `next dev` server on port `3210` via the `webServer` block. If a dev server is already running on that port, Playwright reuses it (unless `CI=true`).

For controller isolation, start the controller with a temp DB:

```bash
VLLM_STUDIO_CHATS_DB=$(mktemp -t vllm-XXXX.db) npm run dev:controller
```
