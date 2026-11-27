#!/usr/bin/env bash
# Runs the full check for Robo Runner: type check, unit tests, production build.
# Usage: bash .kiro/skills/game-customizer/scripts/verify.sh   (from the repo root)
set -u
fail=0
echo "== type check"; npx tsc --noEmit || fail=1
echo "== tests"; npx vitest --run 2>&1 | grep -E "Test Files|Tests|FAIL|×|Error" || true
npx vitest --run >/dev/null 2>&1 || fail=1
echo "== build"; npx vite build 2>&1 | tail -2 || fail=1
rm -rf dist
if [ "$fail" -ne 0 ]; then echo "VERIFY FAILED"; exit 1; fi
echo "VERIFY OK"
