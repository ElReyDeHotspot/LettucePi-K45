#!/bin/sh
set -eu
# Build only the standalone service, not a firmware image.
repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo/integrations/cloudflare"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags='-s -w -buildid=' -o "$repo/payload/usr/libexec/chester-cloudflare" .
sha256sum "$repo/payload/usr/libexec/chester-cloudflare"
