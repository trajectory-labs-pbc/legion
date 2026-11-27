#!/bin/sh
# Upstream's server (envoy-dispatch with no argument) starts with no dashboard when DISPATCH_WEB_DIST
# holds no build; this image's refuses to start instead, so a mistyped folder fails at once.
# Subcommands read no web folder and pass through.
set -eu
dist="${DISPATCH_WEB_DIST:-}"
if [ "$#" -eq 0 ] && { [ -z "$dist" ] || [ ! -f "$dist/index.html" ]; }; then
  echo "envoy-dispatch: DISPATCH_WEB_DIST is '$dist', which holds no index.html; set it to /srv/dispatch-web (upstream's app) or /srv/tl-dispatch (the fork's)" >&2
  exit 78
fi
exec /usr/local/libexec/envoy-dispatch "$@"
