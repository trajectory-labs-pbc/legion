# The fork's envoy image: upstream's envoy image, unchanged, with this app beside upstream's web
# app at /srv/tl-dispatch, its notices, and an envoy-dispatch that refuses a web folder with no
# build. Build context is the repository root (.github/workflows/fork-envoy-image.yaml).

# Upstream's envoy image for this commit's upstream files, by digest.
ARG ENVOY_IMAGE
# The Bun upstream's web stage runs (the `AS web` line of packages/envoy/docker/Dockerfile).
ARG BUN_IMAGE

FROM ${ENVOY_IMAGE} AS envoy

FROM --platform=$BUILDPLATFORM ${BUN_IMAGE} AS web
WORKDIR /repo
# Upstream's lint (.github/scripts/check-bun-workspace-manifests.sh) wants each root workspace's
# manifest copied by name before a frozen install, so the tree is copied after it.
COPY package.json bun.lock .bun-version ./
COPY patches patches
COPY packages/cipher-client/package.json packages/cipher-client/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/envoy-client/package.json packages/envoy-client/package.json
COPY packages/pi-envoy/package.json packages/pi-envoy/package.json
COPY packages/pi-legion/package.json packages/pi-legion/package.json
COPY packages/pi-shared/package.json packages/pi-shared/package.json
COPY packages/claude-envoy/package.json packages/claude-envoy/package.json
COPY packages/proof-editor/package.json packages/proof-editor/package.json
COPY packages/dispatch/package.json packages/dispatch/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json
COPY packages/envoy/internal/dispatch/pmdoc/gen/package.json packages/envoy/internal/dispatch/pmdoc/gen/package.json
COPY docs/site/package.json docs/site/package.json
COPY packages/proof-editor/proof-sdk-*.tgz packages/proof-editor/
# The packages upstream's web stage installs: its build and this app's read no more.
RUN bun install --frozen-lockfile --ignore-scripts \
    --filter './' \
    --filter './packages/dispatch' \
    --filter './packages/contracts' \
    --filter './packages/proof-editor'
COPY . ./
WORKDIR /repo/packages/tl-dispatch
RUN bun install --frozen-lockfile --ignore-scripts && bun scripts/link-root-packages.ts
ARG LEGION_COMMIT=
RUN DISPATCH_BUILD="$LEGION_COMMIT" bun run build \
    && test -s dist/index.html \
    && test -s dist/THIRD_PARTY_NOTICES.txt

# The image's notices with this app's section added, as upstream's assemble script writes one.
FROM --platform=$BUILDPLATFORM ${BUN_IMAGE} AS notices
COPY --from=envoy /usr/share/doc/legion/THIRD_PARTY_NOTICES /out/THIRD_PARTY_NOTICES
COPY --from=web /repo/packages/tl-dispatch/dist/THIRD_PARTY_NOTICES.txt /tmp/tl-dispatch-notices
RUN set -eu; \
    rule="$(printf '%080d' 0 | tr 0 '#')"; \
    { printf '\n%s\n%s\n%s\n\n' "$rule" \
        "npm packages inlined into, and the typeface shipped with, the fork's web app, /srv/tl-dispatch (served as /THIRD_PARTY_NOTICES.txt)" \
        "$rule"; \
      cat /tmp/tl-dispatch-notices; } >> /out/THIRD_PARTY_NOTICES

# Only copies from here, so no target platform runs a command.
FROM envoy AS image
COPY --from=notices /out/THIRD_PARTY_NOTICES /usr/share/doc/legion/THIRD_PARTY_NOTICES
COPY --from=web --chown=envoy:envoy /repo/packages/tl-dispatch/dist /srv/tl-dispatch
COPY --from=envoy /usr/local/bin/envoy-dispatch /usr/local/libexec/envoy-dispatch
COPY packages/tl-dispatch/docker/envoy-dispatch.sh /usr/local/bin/envoy-dispatch
ARG LEGION_COMMIT=
LABEL org.opencontainers.image.revision=${LEGION_COMMIT}

# Built by the workflow on every pull request and before each push, never pushed. Fails when either
# app is missing, the default is not upstream's app, or envoy-dispatch mishandles the folder.
FROM image AS smoke
SHELL ["/bin/sh", "-euc"]
RUN test -s /srv/tl-dispatch/index.html; \
    test -s /srv/dispatch-web/index.html; \
    grep -q "the fork's web app, /srv/tl-dispatch" /usr/share/doc/legion/THIRD_PARTY_NOTICES; \
    test "$DISPATCH_WEB_DIST" = /srv/dispatch-web
# The server on a folder with no build exits 78, before the binary runs.
RUN status=0; DISPATCH_WEB_DIST=/srv /usr/local/bin/envoy-dispatch 2>/tmp/err || status=$?; \
    if [ "$status" -ne 78 ]; then echo "envoy-dispatch on a folder with no build exited $status, not 78" >&2; exit 1; fi
# The server on a built folder reaches the binary, which stops at the missing database.
RUN status=0; DISPATCH_WEB_DIST=/srv/tl-dispatch /usr/local/bin/envoy-dispatch 2>/tmp/err || status=$?; \
    if [ "$status" -eq 78 ] || ! grep -q "DATABASE_URL required" /tmp/err; then cat /tmp/err >&2; exit 1; fi
# A subcommand reaches the binary whatever the folder.
RUN DISPATCH_WEB_DIST=/srv /usr/local/bin/envoy-dispatch settings | grep -q DISPATCH_WEB_DIST
