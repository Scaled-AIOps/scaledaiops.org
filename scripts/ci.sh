#!/usr/bin/env bash
# CI entry point, run by the TeamCity "Check" build on every push. Keep the logic here, not in the TeamCity DSL.
# Builds dist/ and runs the E2E suite against it locally (npm run test:local), not against production.
#   scripts/ci.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# The pinned toolchain exists only on the Linux agent; locally, the node on PATH is used.
[[ "$(uname -s)" == Linux ]] && source scripts/ci-tools.sh
npm ci --no-fund --no-audit
if declare -F ci_browser >/dev/null; then ci_browser; fi
npm run test:local
