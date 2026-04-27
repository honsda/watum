#!/bin/sh
set -eu

# Auto-derive ORIGIN in Coolify if not explicitly set.
# COOLIFY_FQDN may contain multiple domains separated by commas.
if [ -z "${ORIGIN:-}" ] && [ -n "${COOLIFY_FQDN:-}" ]; then
  first_fqdn="${COOLIFY_FQDN%%,*}"
  export ORIGIN="https://${first_fqdn}"
fi

# svelte-adapter-bun only rewrites request.url to use ORIGIN when its computed
# requestOrigin (from HOST_HEADER) differs from ORIGIN. Behind a proxy, Traefik
# forwards the public Host header, so requestOrigin equals ORIGIN and no rewrite
# happens. Bun then passes the internal http:// URL to SvelteKit, which fails
# SvelteKit's built-in remote-functions CSRF check (http vs https).
#
# Fix: point HOST_HEADER at a header Traefik never sends. This makes requestOrigin
# = "https://null", which != ORIGIN, forcing the adapter to rewrite request.url to
# "https://<public-host>/..." before SvelteKit sees it.
export HOST_HEADER="${HOST_HEADER:-x-no-such-header}"

if [ "${AUTO_APPLY_MIGRATIONS:-true}" = "true" ]; then
  bun ./scripts/run-migrations.mjs
fi

exec bun build/index.js
