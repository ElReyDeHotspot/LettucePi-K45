#!/bin/sh
set -eu
# Run with Go >=1.25.5 and git available. Does not build a firmware image.
repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
task=$(mktemp -d /var/tmp/k45p-ndt7.XXXXXX)
commit=1f6adcf81a3f29cae933a2e317e86e24826e2900
git clone https://github.com/m-lab/ndt7-client-go.git "$task/source"
git -C "$task/source" checkout --detach "$commit"
mkdir -p "$task/source/cmd/chester-ndt7"
cp "$repo/integrations/ndt7/main.go" "$task/source/cmd/chester-ndt7/main.go"
cd "$task/source"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags='-s -w -buildid=' -o "$repo/payload/usr/libexec/chester-ndt7" ./cmd/chester-ndt7
sha256sum "$repo/payload/usr/libexec/chester-ndt7"
