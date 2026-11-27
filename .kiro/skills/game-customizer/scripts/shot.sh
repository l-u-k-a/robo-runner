#!/usr/bin/env bash
# Headless-Chrome screenshot of the running game.
# Usage: bash .kiro/skills/game-customizer/scripts/shot.sh "<query string>" /tmp/out.png
# Example: shot.sh "level=8&tool=bomb&use" /tmp/bomb.png
# Needs the dev server (npm run dev). Reuses one on :5173 if present; Vite refuses a second one.
set -u
query="${1:-}"
out="${2:-/tmp/shot.png}"
port="${PORT:-5173}"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if ! curl -sI "http://localhost:${port}/" >/dev/null 2>&1; then
  echo "no dev server on :${port}; start one with: npm run dev" >&2
  exit 2
fi
rm -f "$out"
"$chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1300,800 \
  --virtual-time-budget="${BUDGET:-1500}" --screenshot="$out" "http://localhost:${port}/?${query}" >/dev/null 2>&1
if [ -f "$out" ]; then echo "$out"; else echo "screenshot failed" >&2; exit 1; fi
