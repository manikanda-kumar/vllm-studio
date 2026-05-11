# vLLM Studio

Unified local AI workstation for model lifecycle, chat/agent workflows, orchestration, observability, and remote deployment.

## Lite Mode (Agent Desktop)

For users who only need the coding agent without managing vLLM infrastructure:

- **Default ON** - shows only Agent + Settings tabs
- Toggle in Settings → Appearance → Interface Mode
- Switch to "Full (vLLM Infra)" to access Status, Usage, Models, Server tabs

Use Lite Mode when your org manages the vLLM deployment and you just need the agent desktop.

## OpenRouter Support

Connect to OpenRouter or any OpenAI-compatible API:

1. Go to **Settings → Connection**
2. Set **API URL**: `https://openrouter.ai/api`
3. Set **API Key**: your OpenRouter key
4. Save and select model in Agent dropdown

Works with any provider exposing `/v1/models` and `/v1/chat/completions`.

## Mobile Panel

Test mobile apps directly from the agent workspace:

- **Device control**: list, select, boot emulators/simulators
- **Live view**: iOS streaming via serve-sim, Android via screenshot polling
- **Touch input**: tap-to-interact on device screen
- **Hardware buttons**: HOME, BACK, etc.
- **Logs**: device log viewer

Requires `mobilecli` (npm) for device control. Optional `serve-sim` for iOS 60fps streaming.

```bash
npm install -g mobilecli
npm install -g serve-sim  # optional, iOS only
```

## Agent Verification (built-in)

The internal coding agent ships with a verification loop baked into the runtime — no `.cursor/skills/` setup, no opt-in flag, no per-project rules. Every fresh install gets it.

After each file edit the agent is instructed (and, if needed, forced) to verify the change against the running app:

- `verify_web` — navigate the embedded browser to a URL and capture screenshot / DOM / a11y tree.
- `verify_mobile` — screenshot a connected device (iOS sim or Android emulator) and optionally tail logs.
- `verify_responsive` — capture the same URL across mobile / tablet / desktop viewports.
- `verify_until_pass` — iterative grind loop (up to 3 iterations) whose transcript the agent self-evaluates against free-form `success_criteria`.

Two enforcement layers ship together:

1. A built-in **system-prompt addendum** is injected on every agent spawn, telling the model when to call each tool.
2. A server-side **safety net** in `/api/agent/turn` watches the SSE stream — if the agent edited frontend or mobile files but never called a `verify_*` tool, the server automatically issues a follow-up prompt that forces verification before closing the turn. Look for `auto_verify` SSE events in the chat stream.

A user-facing toggle to disable auto-verify is on the roadmap; today it is always on.

## Release: v1.13.0

This release consolidates major repo changes currently in the tree, including:

- OpenAI proxy activation policy controls for `load_if_idle` and `switch_on_request`
- lifecycle-aware run aborts when model eviction happens
- SSE run stream termination fixes across backend and frontend
- local-only chat/runtime cleanup and controller simplification
- dashboard launch-state cleanup improvements
- reduced chat/controller indirection and removed dead remote-runtime branches

## Docs

- Overview: docs/README.md
- Setup and deployment: docs/operations.md
- Environment variables: docs/environment.md

## Repository layout

- `controller/`: Bun/Hono backend, orchestration, chat runtime, lifecycle, metrics
- `frontend/`: Next.js app, chat UI, proxy endpoints, client state
- `cli/`: Bun CLI for controller access
- `shared/`: shared types/contracts
- `config/`: runtime and integration configs
- `docs/`: documentation index and environment notes
- `scripts/`: operational scripts (deployment + controller daemon helpers)
- `docker-compose.yml`: full stack service definitions
- `scripts/daemon-*.sh`: start/status/stop helpers for background controller runs

## Quick start

1. Controller (local):

```bash
cd controller
npx tsc --noEmit
bun test
bun src/main.ts
```

2. Frontend:

```bash
cd frontend
npm run test
npm run lint
npm run build
npm run dev
```

3. Full stack with Docker (controller + frontend + infra):

```bash
docker compose up -d --build controller frontend
```

4. Run controller as a background daemon:

```bash
./scripts/daemon-start.sh
./scripts/daemon-status.sh
./scripts/daemon-stop.sh
```

## Health checks

```bash
curl -sS http://localhost:8080/health
curl -I http://localhost:3000
```

## API docs

- http://localhost:8080/api/docs
- http://localhost:8080/api/spec

## Setup guide

See `docs/operations.md` for setup, deployment, and verification instructions.

## Branching and release workflow

- Development branch: `dev`
- Production integration branch: `main`
- Release tags: `vX.Y.Z`

For this release:

- merge release work into `main` and `dev`
- tag `v1.13.0`
- create a new post-release working branch
