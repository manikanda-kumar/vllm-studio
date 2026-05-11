# 12 — Pre-push hook wiring

**Status:** `[x]`
**Depends on:** 10
**Owner:** unassigned

## Goal

Block accidental pushes that fail the fast feedback loop. Use existing husky setup (`frontend/.husky/`).

## Context

- Husky already configured (`"prepare": "cd ../.. && husky frontend/.husky"`).
- Pre-commit hook may already exist. Confirm before adding.
- Pre-push runs against the commits about to be pushed.

## Instructions

1. List existing hooks: `ls frontend/.husky/`.
2. Add (or extend) `frontend/.husky/pre-push`:
   ```sh
   #!/usr/bin/env sh
   # Fast feedback loop before push. Bypass: --no-verify (only with explicit user consent).

   cd frontend || exit 1
   echo "[pre-push] running verify..."
   npm run verify
   STATUS=$?
   if [ $STATUS -ne 0 ]; then
     echo "[pre-push] verify FAILED. Fix issues or use 'git push --no-verify' with caution."
     exit $STATUS
   fi
   ```
3. Make executable: `chmod +x frontend/.husky/pre-push`.
4. Document in `frontend/.husky/README.md` (or add to existing): what each hook does, expected timing, how to skip in emergencies.
5. Confirm pre-commit hook (if exists) doesn't already run the same thing — avoid duplication. Pre-commit should stay fast (lint-staged on changed files); pre-push runs full verify.

## Verification

```bash
# Local dry-run: trigger pre-push without actually pushing
cd /Users/manik/Github/vllm-studio
sh frontend/.husky/pre-push
echo "exit=$?"
```

Expected: exit 0 when repo is clean and verify passes.

Failure injection:
```bash
echo "const x: number = 'broken';" > frontend/src/__test_break.ts
sh frontend/.husky/pre-push
echo "exit=$?"   # non-zero
rm frontend/src/__test_break.ts
```

Push simulation:
```bash
git commit --allow-empty -m "test: pre-push hook"
git push --dry-run origin main 2>&1 | head -5
# Then revert: git reset --soft HEAD~1
```

## PASS criteria

- [ ] `frontend/.husky/pre-push` exists, executable
- [ ] Runs `npm run verify` and exits non-zero on failure
- [ ] Does NOT block when verify passes
- [ ] Hook output mentions `--no-verify` escape hatch
- [ ] No duplication with pre-commit
- [ ] `git push --no-verify` still works (sanity for emergencies)

## Notes
