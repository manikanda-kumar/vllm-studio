# Husky hooks

## pre-commit
Runs lint-staged on changed files (fast). Exists separately if configured.

## pre-push
Runs `npm run verify` in `frontend/` — typecheck → lint → unit → smoke.
- Expected wall time: ~25-30s when green.
- Exit non-zero blocks the push.
- Escape hatch: `git push --no-verify` (use with caution).
