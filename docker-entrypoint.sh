#!/bin/sh
set -eu

# Auto-derive ORIGIN in Coolify if not explicitly set.
# COOLIFY_FQDN may contain multiple domains separated by commas.
if [ -z "${ORIGIN:-}" ] && [ -n "${COOLIFY_FQDN:-}" ]; then
  first_fqdn="${COOLIFY_FQDN%%,*}"
  export ORIGIN="https://${first_fqdn}"
fi

if [ "${AUTO_APPLY_MIGRATIONS:-true}" = "true" ]; then
  bun ./scripts/run-migrations.mjs
fi

exec bun build/index.js
