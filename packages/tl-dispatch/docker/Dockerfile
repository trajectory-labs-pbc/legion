# The fork's envoy image: upstream's envoy image, unchanged, with this app beside upstream's web
# app at /srv/tl-dispatch, its notices, and an envoy-dispatch that refuses a web folder with no
# build. Build context is the repository root (.github/workflows/fork-envoy-image.yaml).

# Upstream's envoy image for this commit's upstream files, by digest.
ARG ENVOY_IMAGE
# The Bun upstream's web stage runs (the `AS web` line of packages/envoy/docker/Dockerfile).
ARG BUN_IMAGE

FROM ${ENVOY_IMAGE} AS envoy

# Upstream's files, without this app.
FROM --platform=$BUILDPLATFORM ${BUN_IMAGE} AS context
COPY . /context
RUN rm -rf /context/packages/tl-dispatch

FROM --platform=$BUILDPLATFORM ${BUN_IMAGE} AS web
WORKDIR /repo
# What a frozen install reads, as upstream's web stage copies it: every root workspace's manifest
# (.github/scripts/check-bun-workspace-manifests.sh), the patches and the editor's tarball.
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
COPY --from=context /context/ ./
# This app last, so an edit to it reruns only what follows.
WORKDIR /repo/packages/tl-dispatch
COPY packages/tl-dispatch/package.json packages/tl-dispatch/bun.lock packages/tl-dispatch/bunfig.toml ./
COPY packages/tl-dispatch/scripts scripts
RUN bun install --frozen-lockfile --ignore-scripts && bun scripts/link-root-packages.ts
COPY packages/tl-dispatch ./
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
FROM envoy
COPY --from=notices /out/THIRD_PARTY_NOTICES /usr/share/doc/legion/THIRD_PARTY_NOTICES
COPY --from=web --chown=envoy:envoy /repo/packages/tl-dispatch/dist /srv/tl-dispatch
COPY --from=envoy /usr/local/bin/envoy-dispatch /usr/local/libexec/envoy-dispatch
COPY packages/tl-dispatch/docker/envoy-dispatch.sh /usr/local/bin/envoy-dispatch
ARG LEGION_COMMIT=
LABEL org.opencontainers.image.revision=${LEGION_COMMIT}
