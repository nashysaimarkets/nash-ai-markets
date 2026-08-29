#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for NASH AI Markets — Project Bullseye.
# Pins the Node version the CI quality gate uses, then installs locked deps.
set -euo pipefail

# The CI quality gate (.github/workflows/bullseye-quality-gate.yml) runs on
# Node 22.19.0. Several scripts (e.g. `npm run simulate:production`) execute
# TypeScript through Node's default type stripping, which only exists on
# Node 22.18+. Pin the same version here so every documented command works.
NODE_VERSION="22.19.0"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "[install] nvm not found at $NVM_DIR; cannot pin Node $NODE_VERSION." >&2
  exit 1
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

echo "[install] ensuring Node $NODE_VERSION via nvm"
nvm install "$NODE_VERSION" >/dev/null
nvm alias default "$NODE_VERSION" >/dev/null
node_bin_dir="$(dirname "$(nvm which "$NODE_VERSION")")"

# The Cursor exec daemon prepends its own bundled Node (currently 22.14) to
# PATH, which otherwise shadows nvm in every agent shell. /usr/local/cargo/bin
# comes earlier on PATH and is writable, so point node/npm/npx there to make the
# pinned version authoritative for the dev server, tests and build.
override_dir="/usr/local/cargo/bin"
if [ -d "$override_dir" ] && [ -w "$override_dir" ]; then
  echo "[install] linking node/npm/npx -> $node_bin_dir in $override_dir"
  for bin in node npm npx; do
    ln -sf "$node_bin_dir/$bin" "$override_dir/$bin"
  done
else
  echo "[install] $override_dir not writable; prepending nvm bin to PATH instead" >&2
  export PATH="$node_bin_dir:$PATH"
fi
hash -r

echo "[install] using $(node --version) ($(command -v node))"

echo "[install] installing locked dependencies with npm ci"
npm ci --no-audit --no-fund

echo "[install] done"
