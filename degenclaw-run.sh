#!/usr/bin/env bash
# Windows: .\degenclaw.cmd leaderboard  |  Git Bash: bash degenclaw-run.sh leaderboard
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$ROOT/virtuals-protocol-acp:$PATH"
cd "$ROOT/dgclaw-skill/scripts" || exit 1
exec bash dgclaw.sh "$@"
