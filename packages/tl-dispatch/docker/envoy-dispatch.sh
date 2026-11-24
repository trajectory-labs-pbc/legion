#!/bin/sh
# Upstream's envoy-dispatch starts with no dashboard when DISPATCH_WEB_DIST holds no build; this
# image refuses to start instead, so a mistyped folder fails at once.
set -eu
dist="${DISPATCH_WEB_DIST:-}"
if [ -z "$dist" ] || [ ! -f "$dist/index.html" ]; then
  echo "envoy-dispatch: DISPATCH_WEB_DIST is '$dist', which holds no index.html; set it to /srv/dispatch-web (upstream's app) or /srv/tl-dispatch (the fork's)" >&2
  exit 78
fi
exec /usr/local/libexec/envoy-dispatch "$@"
