#!/bin/sh
set -eu
# Build the account helper only; this never creates a firmware image.
repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
task=$(mktemp -d /var/tmp/k45p-wgcf.XXXXXX)
git clone https://github.com/ViRb3/wgcf.git "$task/source"
git -C "$task/source" checkout --detach de6bba7147dc965a1b8e4de113a709750697ccea
git -C "$task/source" apply --unidiff-zero "$repo/integrations/cloudflare/wgcf-json.patch"
cd "$task/source"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags='-s -w -buildid=' -o "$repo/payload/usr/libexec/chester-wgcf" .
sha256sum "$repo/payload/usr/libexec/chester-wgcf"
