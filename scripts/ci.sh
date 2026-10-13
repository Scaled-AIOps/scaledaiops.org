#!/bin/sh
# CI entry point, run by the TeamCity "Check" build on every push. Keep the logic here, not in the TeamCity DSL.
# Builds dist/ and runs the E2E suite against it locally (npm run test:local), not against production.
#   scripts/ci.sh
set -eu
(set -o pipefail) 2>/dev/null && set -o pipefail # not every sh has pipefail
cd "$(dirname "$0")/.."
# The pinned toolchain exists only on the Linux agent; locally, the node on PATH is used.
if [ "$(uname -s)" = Linux ]; then . scripts/ci-tools.sh; fi
npm ci --no-fund --no-audit
if command -v ci_browser >/dev/null; then ci_browser; fi
npm run test:local
