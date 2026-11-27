#!/usr/bin/env bash
# Runs the guard-AI probe (probe.ts) once, from the repo root, and removes it again.
#   bash .kiro/skills/npc-ai-expert/scripts/probe.sh census HERO=exit
#   bash .kiro/skills/npc-ai-expert/scripts/probe.sh census HERO=start SECONDS=30
#   bash .kiro/skills/npc-ai-expert/scripts/probe.sh trace LEVEL="Bone Hall" GUARD=2 FROM=20 SECONDS=24 EVERY=3
set -u
here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-census}"
shift || true
tmp="tests/__ai_probe__.test.ts"
cp "$here/probe.ts" "$tmp"
out="$(mktemp -t ai-probe)"
trap 'rm -f "$tmp" "$out"' EXIT
if ! env PROBE="$mode" PROBE_OUT="$out" "$@" npx vitest --run "$tmp" >"$out.log" 2>&1; then
  grep -vE "^ *$" "$out.log" | head -40
  rm -f "$out.log"
  exit 1
fi
rm -f "$out.log"
cat "$out"
