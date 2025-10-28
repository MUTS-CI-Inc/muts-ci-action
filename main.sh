#!/usr/bin/env bash
set -euo pipefail

# main wrapper to run the bundled MUTS-CI binary from the action directory.
# We intentionally call the binary directly so we don't rely on the script
# having the executable bit; action will invoke this with `bash`.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MUTS_BIN="$SCRIPT_DIR/MUTS-CI"

if [[ ! -x "$MUTS_BIN" ]]; then
  # If the binary isn't executable, attempt to run it with bash (unlikely) or
  # set +x then fallback to chmod and run.
  if [[ -f "$MUTS_BIN" ]]; then
    chmod +x "$MUTS_BIN" || true
  else
    echo "MUTS-CI binary not found at $MUTS_BIN" >&2
    exit 2
  fi
fi

exec "$MUTS_BIN" "$@"
