#!/bin/bash
# Reproduces a blocked pull request locally, with real git and the same
# commands CI runs. Usage: bash ops/demo/blocked-pr-local.sh [patch-name]
set -u
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
PATCH="${1:-regression-index-body-only}"
WORK="$(mktemp -d)"
for x in src tests evals ops package.json package-lock.json tsconfig.json; do cp -r "$SRC/$x" "$WORK/"; done
ln -s "$SRC/node_modules" "$WORK/node_modules"
cd "$WORK"
git init -q && git config user.email demo@example.com && git config user.name "Demo"
git add -A && git commit -qm "main: green baseline" && git branch -M main
echo "== main is green =="; npx tsx evals/gate.ts | tail -1

git checkout -qb perf/$PATCH
git apply "ops/demo/$PATCH.patch" && git commit -qam "perf: agent-suggested change ($PATCH)"
echo; echo "== PR from branch perf/$PATCH: diff vs main =="; git diff main --stat | tail -3

echo; echo "== CI check 1/2: unit tests =="; npx vitest run 2>&1 | grep -E "Tests " | sed 's/\x1b\[[0-9;]*m//g;s/^ *//'
echo; echo "== CI check 2/2: eval gate =="; npx tsx evals/gate.ts; code=$?
echo; if [ $code -ne 0 ]; then echo ">>> PR STATUS: required check 'evals' FAILED (exit $code) — MERGE BLOCKED"; else echo ">>> PR STATUS: all required checks passed"; fi
exit $code
