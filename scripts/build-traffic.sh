#!/bin/sh
set -eu
repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo/integrations/traffic"
go test ./...
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags='-s -w -buildid=' -o "$repo/payload/usr/libexec/chester-traffic" .
sha256sum "$repo/payload/usr/libexec/chester-traffic"
