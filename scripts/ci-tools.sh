#!/usr/bin/env bash
# Pinned CI toolchain for the TeamCity agent (Linux x64): Node from nodejs.org, checked against the SHA-256 below and
# cached under $CI_TOOLS (the agent's persistent /opt/tools). Versions change here, in git, only.
#   source scripts/ci-tools.sh   # installs Node if missing, puts it on PATH, defines ci_browser
set -euo pipefail

NODE_VERSION=26.10.0
NODE_SHA256=ca70e9e349de048b9522abb3adc05b3bd6f43c5ffd3ec57916c7da292f59f022
CI_TOOLS="${CI_TOOLS:-/opt/tools/scaledaiops}"
node_dir="$CI_TOOLS/node-v$NODE_VERSION"

if [[ ! -x "$node_dir/bin/node" ]]; then
  tmp=$(mktemp -d)
  curl -fsSL --retry 3 -o "$tmp/node.tar.xz" "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz"
  echo "$NODE_SHA256  $tmp/node.tar.xz" | sha256sum -c --quiet -
  mkdir -p "$node_dir" && tar -xJf "$tmp/node.tar.xz" -C "$node_dir" --strip-components=1
  rm -rf "$tmp"
fi

# Browsers are cached next to Node, outside the shared ~/.cache.
export PATH="$node_dir/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$CI_TOOLS/ms-playwright"
echo "ci-tools: node $(node -v), npm $(npm -v)"

# Chromium plus its system libraries; call after `npm ci`. The libraries live in the agent's container layer, so they
# are reinstalled after the agent is recreated; install-deps elevates with sudo, as builds do not run as root.
ci_browser() {
  npx playwright install chromium
  ldconfig -p | grep -q libnspr4.so || npx playwright install-deps chromium
}
